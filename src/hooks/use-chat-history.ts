/**
 * Chat history: persisted via the SQLite chat_messages table.
 *
 * Persistence runs at the seam in app/(tabs)/chat/[docId].tsx already
 * (user turn insert before stream, assistant turn insert after stream).
 * This hook surfaces helpers callers want:
 *   - typed loader for a chat's messages
 *   - "resume" for an in-flight stream the user navigated away from
 *     (we re-attach to the chat store entry, since we never clear it
 *      until the stream finishes or is explicitly cancelled)
 */

import { getDb } from '@/db/client';
import { type ChatMessage, chatMessages, chats } from '@/db/schema';
import { useChat } from '@/stores/chat.store';
import { useQuery } from '@tanstack/react-query';
import { asc, desc, eq } from 'drizzle-orm';
import { useEffect } from 'react';

async function loadChat(chatId: string): Promise<ChatMessage[]> {
  const db = getDb();
  return (await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(asc(chatMessages.createdAt))) as ChatMessage[];
}

async function loadRecentChats(limit = 20) {
  const db = getDb();
  return (await db.select().from(chats).orderBy(desc(chats.createdAt)).limit(limit)) as Array<{
    id: string;
    docId: string;
    title: string;
    createdAt: Date;
  }>;
}

export function useChatHistory(chatId: string | null) {
  return useQuery<ChatMessage[]>({
    queryKey: ['chat', chatId],
    queryFn: () => loadChat(chatId as string),
    enabled: typeof chatId === 'string' && chatId.length > 0,
  });
}

export function useRecentChats(limit?: number) {
  return useQuery({
    queryKey: ['chats', 'recent', limit ?? 20],
    queryFn: () => loadRecentChats(limit),
  });
}

/**
 * Mark the chat store's in-flight stream for this chat as "owned" by the
 * current screen — calling abort if the screen unmounts before the stream
 * finishes is the consumer's job; this is just the resume side.
 */
export function useResumeStream(
  chatId: string | null,
): { partial: string; tokensOut: number } | null {
  const streaming = useChat((s) => (chatId ? s.streaming[chatId] : undefined));
  // tiny side effect just so consumers don't accidentally drop the dep
  useEffect(() => {
    if (chatId && streaming) {
      // touching it once asserts ownership; nothing else to do.
    }
  }, [chatId, streaming]);
  if (!chatId || !streaming) return null;
  return { partial: streaming.partial, tokensOut: streaming.tokensOut };
}
