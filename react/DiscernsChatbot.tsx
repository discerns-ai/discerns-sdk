import { useEffect, useRef, useState, type CSSProperties, useEffectEvent } from 'react';
import type { EnvironmentContext, RegisteredTool, WebsiteProtocol } from '../js';
import { connectToDiscernsChatbot } from '../js';


interface DiscernsChatbotProps {
    baseUrl?: string;
    avatarId: number;
    avatarInstanceId: number | null;
    memoizedTools?: RegisteredTool[];
    avatarContext?: string;
    memoizedEnvironmentContext?: Record<string, EnvironmentContext>
    onConnectionStatusChange?: (connected: boolean) => void;
    onNewConversation?: (conversationId: string) => void;
    style?: CSSProperties;
    className?: string;
    theme?: 'light' | 'dark';
    accent?: string;
}


export function DiscernsChatbot({
    baseUrl = 'https://app.discerns.ai',
    avatarInstanceId,
    avatarId,
    theme,
    accent,
    style,
    className,
    memoizedTools,
    avatarContext,
    memoizedEnvironmentContext,
    onConnectionStatusChange,
    onNewConversation,
}: DiscernsChatbotProps) {
    const [protocol, setProtocol] = useState<WebsiteProtocol | undefined>(undefined);
    const ref = useRef<HTMLIFrameElement>(null);
    useEffect(() => {
        const p = undefined as WebsiteProtocol | undefined;
        let disposed = false;

        async function run() {
            const protocol = await connectToDiscernsChatbot(
                ref.current!,
            );
            if (disposed) {
                return protocol.dispose();
            }
            setProtocol(protocol);
        }

        void run();

        return () => {
            if (p) p.dispose();
            disposed = true;
        };
    }, []);

    const loadingToolsRef = useRef<Promise<unknown> | null>(null);
    useEffect(() => {
        if (!protocol || !memoizedTools) return;

        let registered = false;

        async function run() {
            try {
                await loadingToolsRef.current;
                const promise = Promise.all(memoizedTools!.map(t => protocol!.registerTool(t)));
                loadingToolsRef.current = promise;
                await promise;
                registered = true;
            } catch (e) {
                console.error(e);
            }
        }

        run();

        return () => {
            if (!registered) return; 
            memoizedTools.forEach(t => {
                protocol.unregisterTool(t.name).catch(e => {
                    console.error(`Failed to unregister tool ${t.name}:`, e);
                });
            });
            
        };
    }, [protocol, memoizedTools]);

    useEffect(() => {
        if (!protocol) return;
        protocol.setAvatarContext(avatarContext || null);

        return () => {
            protocol.setAvatarContext(null);
        };
    }, [protocol, avatarContext]);

    useEffect(() => {
        if (!memoizedEnvironmentContext || !protocol) return;
        const keys = Object.keys(memoizedEnvironmentContext);

        for (const key of keys) {
            protocol.addToContext(key, memoizedEnvironmentContext[key]);
        }

        return () => {
            for (const key of keys) {
                protocol.removeFromContext(key);
            }
        };
    }, [protocol, memoizedEnvironmentContext]);

    const onConnectionStatusChangeHandler = useEffectEvent((connected: boolean) => {
        onConnectionStatusChange?.(connected);
    });

    const onNewConversationHandler = useEffectEvent((conversationId: string) => {
        onNewConversation?.(conversationId);
    });

    useEffect(() => {
        if (!protocol) return;

        return protocol.onConnectionStatus(onConnectionStatusChangeHandler);
    }, [protocol]);

    useEffect(() => {
        if (!protocol) return;

        return protocol.onNewConversation(onNewConversationHandler);
    }, [protocol]);

    const url = `${baseUrl}/avatars/${avatarId}/chat/embed?${avatarInstanceId ? `avatarInstanceId=${avatarInstanceId}&` : ''}theme=${theme || 'light'}${accent ? `&accent=${encodeURIComponent(accent)}` : ''}`;

    return <iframe
        src={url}
        ref={ref}
        allow="microphone; picture-in-picture;"
        className={className}
        style={style 
            ? style
            : {
                border: 'solid 1px #dad5cf',
                borderRadius: '1.3rem',
                width: 'min(50ch, 100%)',
                height: 'min(90dvh, 60ch)',
            }}
    />;
}