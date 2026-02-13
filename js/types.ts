import type { AskEvent, TellEvent } from './chatbot-two-way-listener';
import type { JSONSchema } from 'zod/v4/core';

export type KnowkedgeType = 'none' | 'normal-with-rerank' | 'normal' | 'agentic' | 'agentic-with-rerank';

export type EnvironmentContext = {
    name: string
    value: string
    description: string
};



export type Tool = {
    name: string
    description: string
    schema: JSONSchema.JSONSchema
};


// Message envelope for postMessage communication
export type ProtocolMessage<T = unknown> = {
    type: 'ask' | 'tell' | 'ask-response'
    event: string
    payload: T
    messageId?: string
};

// ============================================
// Website -> Chatbot communication (Tell events)
// ============================================
export type WebsiteToChatbotTellSchema = {
    'chatbot:add-necessary-context': TellEvent<{
        keyName: string
        value: EnvironmentContext
    }>
    'chatbot:remove-necessary-context': TellEvent<{
        keyName: string
    }>
    'chatbot:set-avatar-context': TellEvent<{
        avatarContext: string | null
    }>
};

// ============================================
// Website -> Chatbot communication (Ask events)
// ============================================
export type WebsiteToChatbotAskSchema = {
    'chatbot:ping': AskEvent<void, 'pong'>
    'chatbot:register-tool': AskEvent<Tool, { success: boolean }>
    'chatbot:unregister-tool': AskEvent<{ name: string }, { success: boolean }>
};

// ============================================
// Chatbot -> Website communication (Tell events)
// ============================================
export type ChatbotToWebsiteTellSchema = {
    'website:new-conversation': TellEvent<{
        conversationId: string
    }>
    'website:connection-status': TellEvent<{
        connected: boolean
    }>
};

// ============================================
// Chatbot -> Website communication (Ask events - tool calls)
// ============================================
export type ChatbotToWebsiteAskSchema = {
    'website:tool-call': AskEvent<{
        name: string
        args: unknown
    }, {
        ok: boolean
        value: unknown
    }>
    'website:ping': AskEvent<void, 'pong'>
};