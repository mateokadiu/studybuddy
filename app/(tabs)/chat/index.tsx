import { FlatList, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { chats, documents, type Chat } from '@/db/schema';
import { id as uuid } from '@/lib/id';

interface ChatRow extends Chat {
  docTitle: string | null;
}

async function loadChats(): Promise<ChatRow[]> {
  const db = getDb();
  return (await db
    .select({
      id: chats.id,
      docId: chats.docId,
      title: chats.title,
      createdAt: chats.createdAt,
      docTitle: documents.title,
    })
    .from(chats)
    .leftJoin(documents, eq(documents.id, chats.docId))
    .orderBy(desc(chats.createdAt))) as ChatRow[];
}

async function loadReadyDocs() {
  const db = getDb();
  return (await db
    .select()
    .from(documents)
    .where(eq(documents.status, 'ready'))
    .orderBy(desc(documents.importedAt))) as Array<{ id: string; title: string }>;
}

export default function ChatListScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const chatsQ = useQuery({ queryKey: ['chats'], queryFn: loadChats });
  const docsQ = useQuery({ queryKey: ['chats', 'ready-docs'], queryFn: loadReadyDocs });

  const start = useMutation({
    mutationFn: async (docId: string) => {
      const db = getDb();
      const chatId = uuid();
      await db.insert(chats).values({
        id: chatId,
        docId,
        title: 'new chat',
        createdAt: new Date(),
      });
      return chatId;
    },
    onSuccess: (chatId, docId) => {
      qc.invalidateQueries({ queryKey: ['chats'] });
      router.push(`/(tabs)/chat/${docId}?chatId=${chatId}` as never);
    },
  });

  if (chatsQ.isPending || docsQ.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>start a new chat</Text>
        {(docsQ.data ?? []).length === 0 ? (
          <Text style={styles.muted}>import a doc first</Text>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={docsQ.data ?? []}
            keyExtractor={(d) => d.id}
            renderItem={({ item }) => (
              <Pressable style={styles.docChip} onPress={() => start.mutate(item.id)}>
                <Text style={styles.docChipText} numberOfLines={1}>
                  {item.title}
                </Text>
              </Pressable>
            )}
            contentContainerStyle={{ gap: 8 }}
          />
        )}
      </View>

      <FlatList
        data={chatsQ.data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/(tabs)/chat/${item.docId}?chatId=${item.id}` as never)}
          >
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.sub}>{item.docTitle ?? '(unknown doc)'}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.muted}>no chats yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = {
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 } as const,
  muted: { color: '#7a818b' } as const,
  section: { padding: 12, borderBottomColor: '#1f2329', borderBottomWidth: 1, gap: 8 } as const,
  sectionTitle: { color: '#7a818b', fontSize: 12 } as const,
  docChip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#1a1d23', borderRadius: 16 } as const,
  docChipText: { color: '#e6e8eb', fontSize: 13 } as const,
  row: { backgroundColor: '#1a1d23', padding: 12, borderRadius: 8 } as const,
  title: { color: '#e6e8eb', fontSize: 16, fontWeight: '600' } as const,
  sub: { color: '#7a818b', fontSize: 12, marginTop: 2 } as const,
};
