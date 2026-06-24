import { CiteChip } from '@/components/cite-chip/CiteChip';
import { getDb } from '@/db/client';
import { type ChatMessage, chatMessages, chats } from '@/db/schema';
import { id as uuid } from '@/lib/id';
import { answer } from '@/services/rag.service';
import { useChat } from '@/stores/chat.store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { asc, eq } from 'drizzle-orm';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

async function loadChat(chatId: string): Promise<ChatMessage[]> {
  const db = getDb();
  return (await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(asc(chatMessages.createdAt))) as ChatMessage[];
}

export default function ChatDocScreen() {
  const { docId, chatId } = useLocalSearchParams<{ docId: string; chatId: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => loadChat(chatId as string),
    enabled: typeof chatId === 'string',
  });

  const draft = useChat((s) => s.drafts[chatId as string] ?? '');
  const setDraft = useChat((s) => s.setDraft);
  const streaming = useChat((s) => s.streaming[chatId as string]);
  const startStream = useChat((s) => s.startStream);
  const appendStream = useChat((s) => s.appendStream);
  const finishStream = useChat((s) => s.finishStream);

  const listRef = useRef<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async () => {
    const text = draft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    const db = getDb();

    // persist the user turn
    const userTurnId = uuid();
    const now = new Date();
    await db.insert(chatMessages).values({
      id: userTurnId,
      chatId: chatId as string,
      role: 'user',
      content: text,
      cites: null,
      tokensIn: null,
      tokensOut: null,
      createdAt: now,
    });

    // set chat title to first user msg if still default
    const titleRows = (await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId as string))) as Array<{
      title: string;
    }>;
    if (titleRows[0]?.title === 'new chat') {
      await db
        .update(chats)
        .set({ title: text.slice(0, 60) })
        .where(eq(chats.id, chatId as string));
    }

    setDraft(chatId as string, '');
    qc.invalidateQueries({ queryKey: ['chat', chatId] });

    // stream the assistant turn
    startStream(chatId as string, 0);
    const history = (q.data ?? []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    try {
      let finalCites: Array<{ chunkId: string; page: number }> = [];
      let finalTokensIn = 0;
      let finalTokensOut = 0;
      let finalText = '';
      for await (const part of answer(docId as string, text, history)) {
        finalText += part.text;
        finalCites = part.cites;
        finalTokensIn = part.tokensIn;
        finalTokensOut = part.tokensOut;
        appendStream(chatId as string, part.text, part.tokensOut);
      }
      await db.insert(chatMessages).values({
        id: uuid(),
        chatId: chatId as string,
        role: 'assistant',
        content: finalText,
        cites: JSON.stringify(finalCites),
        tokensIn: finalTokensIn,
        tokensOut: finalTokensOut,
        createdAt: new Date(),
      });
    } finally {
      finishStream(chatId as string);
      setSubmitting(false);
      qc.invalidateQueries({ queryKey: ['chat', chatId] });
    }
  }, [
    draft,
    submitting,
    chatId,
    docId,
    q.data,
    qc,
    setDraft,
    startStream,
    appendStream,
    finishStream,
  ]);

  if (q.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={[
          ...(q.data ?? []),
          ...(streaming
            ? [
                {
                  id: '__streaming',
                  chatId: chatId as string,
                  role: 'assistant',
                  content: streaming.partial,
                  cites: null,
                  tokensIn: streaming.tokensIn,
                  tokensOut: streaming.tokensOut,
                  createdAt: new Date(),
                } as ChatMessage,
              ]
            : []),
        ]}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => <Bubble msg={item} />}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="ask the doc…"
          placeholderTextColor="#7a818b"
          value={draft}
          onChangeText={(t) => setDraft(chatId as string, t)}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable style={styles.send} onPress={submit} disabled={submitting}>
          <Text style={styles.sendText}>{submitting ? '…' : 'send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  const cites = msg.cites
    ? (JSON.parse(msg.cites) as Array<{ chunkId: string; page: number }>)
    : [];
  const showUsage = !isUser && (msg.tokensIn != null || msg.tokensOut != null);
  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
      <Text style={styles.bubbleText}>{msg.content}</Text>
      {cites.length > 0 ? (
        <View style={styles.citeRow}>
          {cites.map((c, i) => (
            <CiteChip key={`${c.chunkId}-${c.page}-${i}`} chunkId={c.chunkId} page={c.page} />
          ))}
        </View>
      ) : null}
      {showUsage ? (
        <View style={styles.usage}>
          <Text style={styles.usageText}>
            in {msg.tokensIn ?? 0} · out {msg.tokensOut ?? 0}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = {
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' } as const,
  inputRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    borderTopColor: '#1f2329',
    borderTopWidth: 1,
  } as const,
  input: {
    flex: 1,
    backgroundColor: '#1a1d23',
    color: '#e6e8eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as const,
  send: {
    backgroundColor: '#7aa2ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  sendText: { color: '#0f1115', fontWeight: '600' } as const,
  bubble: { padding: 10, borderRadius: 10, maxWidth: '90%' } as const,
  userBubble: { backgroundColor: '#7aa2ff', alignSelf: 'flex-end' } as const,
  botBubble: { backgroundColor: '#1a1d23', alignSelf: 'flex-start' } as const,
  bubbleText: { color: '#e6e8eb', fontSize: 14 } as const,
  citeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 } as const,
  usage: { marginTop: 4, alignSelf: 'flex-end' } as const,
  usageText: { color: '#7a818b', fontSize: 10 } as const,
};
