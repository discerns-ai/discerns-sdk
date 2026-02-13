import { type EventPayload, TwoWayProtocol } from './chatbot-two-way-listener';
import type {
    ChatbotToWebsiteAskSchema,
    ChatbotToWebsiteTellSchema,
    EnvironmentContext,
    ProtocolMessage,
    WebsiteToChatbotAskSchema,
    WebsiteToChatbotTellSchema,
} from './types';
import { z } from 'zod/v4';

// The website sends Tell/Ask to chatbot, and receives Tell/Ask from chatbot
type WebsiteOutgoingAskSchema = WebsiteToChatbotAskSchema;

type WebsiteOutgoingTellSchema = WebsiteToChatbotTellSchema;

type WebsiteIncomingAskSchema = ChatbotToWebsiteAskSchema;

type WebsiteIncomingTellSchema = ChatbotToWebsiteTellSchema;

const PROTOCOL_PREFIX = 'discerns-protocol';

export type RegisteredTool<T extends z.ZodType = z.ZodType> = {
    name: string
    description: string
    schema: T
    execute: (args: z.infer<T>) => Promise<unknown> | unknown
};



export type WebsiteProtocolOptions = {
    /** The target origin for postMessage. Defaults to '*' */
    targetOrigin?: string
    /** Timeout for ask requests in ms. Defaults to 30000 */
    askTimeout?: number
};

export async function connectToDiscernsChatbot(
    chatbotIframe: HTMLIFrameElement,
    options: WebsiteProtocolOptions = {},
) {
    const { targetOrigin = '*', askTimeout = 30000 } = options;

    // Protocol for handling incoming messages from the chatbot
    const incomingProtocol = new TwoWayProtocol<WebsiteIncomingAskSchema, WebsiteIncomingTellSchema>();

    // Map to store pending ask responses we're waiting for from chatbot
    const pendingAskResponses = new Map<string, {
        resolve: (value: unknown) => void
        reject: (error: Error) => void
    }>();

    // Map to store registered tools
    const registeredTools = new Map<string, RegisteredTool>();

    let messageIdCounter = 0;
    let isConnected = false;

    // Declare tell events that the website can receive from chatbot
    incomingProtocol.declareTellEvent('website:new-conversation');
    incomingProtocol.declareTellEvent('website:connection-status');

    // Register handlers for ask events from chatbot
    incomingProtocol.registerUniqueAskHandler('website:ping', () => 'pong');

    incomingProtocol.registerUniqueAskHandler('website:tool-call', async ({ name, args }) => {
        const tool = registeredTools.get(name);
        if (!tool) {
            return { ok: false, value: `Tool "${name}" not found` };
        }

        try {
            // Validate args with the zod schema
            const validatedArgs = tool.schema.parse(args);
            const result = await tool.execute(validatedArgs);

            return { ok: true, value: result };
        } catch (error) {
            return { ok: false, value: String(error) };
        }
    });


    // Send a message to the chatbot iframe
    function sendMessage(message: ProtocolMessage) {
        const iframeWindow = chatbotIframe.contentWindow;
        if (!iframeWindow) {
            console.error('Chatbot iframe content window not available');

            return;
        }
        iframeWindow.postMessage({ ...message, prefix: PROTOCOL_PREFIX }, targetOrigin);
    }

    // Ask the chatbot to do something and wait for response
    function askChatbot<T extends keyof WebsiteOutgoingAskSchema>(
        event: T,
        payload: EventPayload<WebsiteOutgoingAskSchema, T>,
        timeout?: number,
    ): Promise<WebsiteOutgoingAskSchema[T]['response']> {
        return new Promise((resolve, reject) => {
            const messageId = `website-ask-${++messageIdCounter}`;
            pendingAskResponses.set(messageId, {
                resolve: resolve as (value: unknown) => void,
                reject,
            });

            sendMessage({
                type: 'ask',
                event,
                payload,
                messageId,
            });

            // Timeout
            setTimeout(() => {
                if (pendingAskResponses.has(messageId)) {
                    pendingAskResponses.delete(messageId);
                    reject(new Error(`Ask "${event}" timed out`));
                }
            }, timeout ?? askTimeout);
        });
    }

    // Tell the chatbot something (fire and forget)
    function tellChatbot<T extends keyof WebsiteOutgoingTellSchema>(
        event: T,
        payload: EventPayload<WebsiteOutgoingTellSchema, T>,
    ) {
        sendMessage({
            type: 'tell',
            event,
            payload,
        });
    }

    // Handle incoming messages from the chatbot
    function handleMessage(event: MessageEvent) {
        // Verify the message source is from the iframe
        if (event.source !== chatbotIframe.contentWindow) {
            return;
        }

        const data = event.data;

        // Validate the message format
        if (typeof data !== 'object' || !data || data.prefix !== PROTOCOL_PREFIX) {
            return;
        }

        const message = data as ProtocolMessage & { prefix: string };

        if (message.type === 'tell') {
            // Chatbot is telling us something
            try {
                incomingProtocol.tell(
                    message.event as keyof WebsiteIncomingTellSchema,
                    message.payload as EventPayload<WebsiteIncomingTellSchema, keyof WebsiteIncomingTellSchema>,
                );
            } catch (error) {
                console.error(`Failed to handle tell event "${message.event}":`, error);
            }
        } else if (message.type === 'ask') {
            // Chatbot is asking us something, we need to respond
            void (async () => {
                try {
                    const response = await incomingProtocol.ask(
                        message.event as keyof WebsiteIncomingAskSchema,
                        message.payload as EventPayload<WebsiteIncomingAskSchema, keyof WebsiteIncomingAskSchema>,
                    );
                    sendMessage({
                        type: 'ask-response',
                        event: message.event,
                        payload: { ok: true, value: response },
                        messageId: message.messageId,
                    });
                } catch (error) {
                    sendMessage({
                        type: 'ask-response',
                        event: message.event,
                        payload: { ok: false, value: String(error) },
                        messageId: message.messageId,
                    });
                }
            })();
        } else if (message.type === 'ask-response') {
            // Response to an ask we sent to the chatbot
            const pending = pendingAskResponses.get(message.messageId!);
            if (pending) {
                pendingAskResponses.delete(message.messageId!);
                const response = message.payload as { ok: boolean; value: unknown };
                if (response.ok) {
                    pending.resolve(response.value);
                } else {
                    pending.reject(new Error(String(response.value)));
                }
            }
        }
    }

    // Listen for messages from the chatbot
    window.addEventListener('message', handleMessage);

    // ============================================
    // Public API for websites
    // ============================================

    /**
     * Register a tool that the chatbot can call
     */
    async function registerTool<T extends z.ZodType>(tool: RegisteredTool<T>): Promise<{ success: boolean }> {

        registeredTools.set(tool.name, tool);

        // Tell the chatbot about this tool
        const result = await askChatbot('chatbot:register-tool', {
            name: tool.name,
            description: tool.description,
            schema: z.toJSONSchema(tool.schema),
        });

        if (!result.success) {
            registeredTools.delete(tool.name);
        }

        return result;
    }

    /**
     * Unregister a previously registered tool
     */
    async function unregisterTool(name: string): Promise<{ success: boolean }> {
        const result = await askChatbot('chatbot:unregister-tool', { name });

        if (result.success) {
            registeredTools.delete(name);
        }

        return result;
    }

    /**
     * Add context that the chatbot should use
     */
    function addToContext(keyName: string, value: EnvironmentContext) {
        tellChatbot('chatbot:add-necessary-context', { keyName, value });
    }

    /**
     * Remove context from the chatbot
     */
    function removeFromContext(keyName: string) {
        tellChatbot('chatbot:remove-necessary-context', { keyName });
    }

    /**
     * Set the avatar context
     */
    function setAvatarContext(avatarContext: string | null) {
        tellChatbot('chatbot:set-avatar-context', { avatarContext });
    }


    /**
     * Check if the chatbot is connected and responsive
     */
    async function ping(): Promise<boolean> {
        try {
            const response = await askChatbot('chatbot:ping', undefined as void, 100);

            return response === 'pong';
        } catch {
            return false;
        }
    }

    /**
     * Listen for new conversation events
     */
    function onNewConversation(callback: (conversationId: string) => void) {
        const id = incomingProtocol.on('website:new-conversation', ({ conversationId }) => {
            callback(conversationId);
        });

        return () => {
            incomingProtocol.off('website:new-conversation', id);
        };
    }

    /**
     * Listen for connection status changes
     */
    function onConnectionStatus(callback: (connected: boolean) => void) {
        const id = incomingProtocol.on('website:connection-status', ({ connected }) => {
            isConnected = connected;
            callback(connected);
        });

        return () => {
            incomingProtocol.off('website:connection-status', id);
        };
    }

    /**
     * Remove a listener by its ID
     */
    function removeListener(event: keyof WebsiteIncomingTellSchema, listenerId: number) {
        return incomingProtocol.off(event, listenerId);
    }

    /**
     * Dispose the protocol and clean up resources
     */
    function dispose() {
        window.removeEventListener('message', handleMessage);
        pendingAskResponses.clear();
        registeredTools.clear();
    }
    
    function awaitConnection() {
        return new Promise(async resolve => {
            if (await ping()) {
                return resolve(null);
            }
            const interval = setInterval(async () => {
                if (await ping()) {
                    resolve(null);
                    clearInterval(interval);
                }
            }, 500);
        });
    }

    await awaitConnection();

    return {
        registerTool,
        unregisterTool,
        addToContext,
        removeFromContext,
        setAvatarContext,
        onNewConversation,
        onConnectionStatus,
        dispose,
    };
}

export type WebsiteProtocol = Awaited<ReturnType<typeof connectToDiscernsChatbot>>;

// Re-export types that users of the SDK will need
export type {
    EnvironmentContext,
    KnowkedgeType,
    Tool,
} from './types';


export function tool<T extends z.ZodType>(tool: RegisteredTool<T>): RegisteredTool<T> {
    return tool;
}