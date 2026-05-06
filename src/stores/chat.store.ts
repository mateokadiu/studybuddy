import { create } from 'zustand';
import type { ChatTurn } from '@/types/chat';

interface ChatStore {
  /** active in-flight stream, keyed by chatId */
  streaming: Record<string, { partial: string; tokensIn: number; tokensOut: number }>;
  /** open chat -> currently composed user message */
  drafts: Record<string, string>;

  setDraft(chatId: string, text: string): void;
  startStream(chatId: string, tokensIn: number): void;
  appendStream(chatId: string, chunk: string, tokensOut: number): void;
  finishStream(chatId: string): void;
  reset(chatId: string): void;
}

export const useChat = create<ChatStore>((set) => ({
  streaming: {},
  drafts: {},

  setDraft: (chatId, text) =>
    set((s) => ({ drafts: { ...s.drafts, [chatId]: text } })),
  startStream: (chatId, tokensIn) =>
    set((s) => ({
      streaming: { ...s.streaming, [chatId]: { partial: '', tokensIn, tokensOut: 0 } },
    })),
  appendStream: (chatId, chunk, tokensOut) =>
    set((s) => {
      const cur = s.streaming[chatId];
      if (!cur) return s;
      return {
        streaming: {
          ...s.streaming,
          [chatId]: { partial: cur.partial + chunk, tokensIn: cur.tokensIn, tokensOut },
        },
      };
    }),
  finishStream: (chatId) =>
    set((s) => {
      const { [chatId]: _, ...rest } = s.streaming;
      return { streaming: rest };
    }),
  reset: (chatId) =>
    set((s) => {
      const { [chatId]: __, ...rests } = s.streaming;
      const { [chatId]: ___, ...restd } = s.drafts;
      return { streaming: rests, drafts: restd };
    }),
}));

export type { ChatTurn };
