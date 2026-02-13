import { connectToDiscernsChatbot } from './website-protocol';

export {
    connectToDiscernsChatbot,
    type RegisteredTool,
    type WebsiteProtocol,
    tool,
} from './website-protocol';

// Types
export type {
    KnowkedgeType,
    EnvironmentContext,
    Tool,
} from './types';



type MakeEmbedOptions = {
    target: HTMLElement
    baseUrl?: string
    avatarId: number
    avatarInstanceId: string | null
    style?: string,
    theme?: 'dark' | 'light'
    accent?: string
    className?: string,
};

export async function createDiscernsEmbed(options: MakeEmbedOptions) {
    const iframe = document.createElement('iframe');
    iframe.style = `border: solid 1px #dad5cf; border-radius: 1.3rem; width: 60ch; height: min(calc(100dvh - 1rem), 70ch); ${options.style || ''}`;
    iframe.className = options.className || '';
    const baseUrl = options.baseUrl || 'https://app.discerns.ai';
    iframe.src = `${baseUrl}/avatars/${options.avatarId}/chat/embed?${options.avatarInstanceId ? `avatarInstanceId=${options.avatarInstanceId}&` : ''}theme=${options.theme || 'light'}${options.accent ? `&accent=${encodeURIComponent(options.accent)}` : ''}`;
    iframe.allow = 'microphone; picture-in-picture;';
    options.target.appendChild(iframe);
    const protocol = await connectToDiscernsChatbot(iframe);

    return {
        protocol,
        iframe,
        dispose: () => {
            iframe.remove();
            protocol.dispose();
        },
    };
}