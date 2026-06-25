import { getDb } from '@/db/client';
import { type Chunk, type Document, chunks, documents } from '@/db/schema';
import { useQuery } from '@tanstack/react-query';
import { asc, eq } from 'drizzle-orm';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

interface DocDetail {
  doc: Document;
  chunks: Pick<Chunk, 'id' | 'idx' | 'pageStart' | 'pageEnd' | 'tokenCount'>[];
}

async function loadDocDetail(docId: string): Promise<DocDetail | null> {
  const db = getDb();
  const docs = (await db.select().from(documents).where(eq(documents.id, docId))) as Document[];
  if (docs.length === 0) return null;

  const rows = (await db
    .select({
      id: chunks.id,
      idx: chunks.idx,
      pageStart: chunks.pageStart,
      pageEnd: chunks.pageEnd,
      tokenCount: chunks.tokenCount,
    })
    .from(chunks)
    .where(eq(chunks.docId, docId))
    .orderBy(asc(chunks.idx))) as DocDetail['chunks'];

  return { doc: docs[0] as Document, chunks: rows };
}

export default function DocDetailScreen() {
  const { docId, focusChunkId } = useLocalSearchParams<{ docId: string; focusChunkId?: string }>();
  const router = useRouter();
  const q = useQuery({
    queryKey: ['library', 'doc', docId],
    queryFn: () => loadDocDetail(docId),
    enabled: typeof docId === 'string' && docId.length > 0,
  });

  const totalTokens = useMemo(
    () => (q.data?.chunks ?? []).reduce((a, c) => a + c.tokenCount, 0),
    [q.data],
  );

  // FlatList ref-based scroll-to-index when a chip routes us here
  const listRef = useRef<{ scrollToIndex(p: { index: number; animated?: boolean }): void } | null>(
    null,
  );
  useEffect(() => {
    if (!focusChunkId || !q.data) return;
    const idx = q.data.chunks.findIndex((c) => c.id === focusChunkId);
    if (idx >= 0 && listRef.current) {
      // small delay so layout is committed first
      const t = setTimeout(() => {
        try {
          listRef.current?.scrollToIndex({ index: idx, animated: true });
        } catch {
          // index out of range during initial render is harmless
        }
      }, 100);
      return () => clearTimeout(t);
    }
  }, [focusChunkId, q.data]);

  if (q.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!q.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>document not found</Text>
      </View>
    );
  }

  const { doc, chunks: chunkRows } = q.data;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>{doc.title}</Text>
        <Text style={styles.sub}>
          {doc.status} · {doc.pageCount} pp · {chunkRows.length} chunks ·{' '}
          {Math.round(totalTokens / 1000)}k tokens
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Pressable
            style={styles.cta}
            onPress={() => router.push(`/(tabs)/chat/${doc.id}` as never)}
          >
            <Text style={styles.ctaText}>chat with doc</Text>
          </Pressable>
          <Pressable
            style={styles.ctaOutline}
            onPress={() => router.push(`/(tabs)/decks?docId=${doc.id}` as never)}
          >
            <Text style={styles.ctaOutlineText}>view decks</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        ref={listRef as never}
        data={chunkRows}
        keyExtractor={(c, i) => `${c.id ?? 'row'}-${i}`}
        contentContainerStyle={{ padding: 12, gap: 6 }}
        renderItem={({ item }) => (
          <View style={[styles.row, focusChunkId === item.id ? styles.rowFocused : null]}>
            <Text style={styles.rowTitle}>
              chunk {item.idx + 1} · pp.{item.pageStart}-{item.pageEnd}
            </Text>
            <Text style={styles.rowSub}>{item.tokenCount} tokens</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = {
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' } as const,
  muted: { color: '#7a818b' } as const,
  header: { padding: 16, borderBottomColor: '#1f2329', borderBottomWidth: 1 } as const,
  title: { color: '#e6e8eb', fontSize: 20, fontWeight: '700' } as const,
  sub: { color: '#7a818b', fontSize: 12, marginTop: 4 } as const,
  cta: {
    backgroundColor: '#7aa2ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  } as const,
  ctaText: { color: '#0f1115', fontWeight: '600' } as const,
  ctaOutline: {
    borderColor: '#7aa2ff',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  } as const,
  ctaOutlineText: { color: '#7aa2ff', fontWeight: '600' } as const,
  row: { backgroundColor: '#1a1d23', padding: 10, borderRadius: 6 } as const,
  rowFocused: { backgroundColor: '#1e3a5f', borderColor: '#7aa2ff', borderWidth: 1 } as const,
  rowTitle: { color: '#e6e8eb', fontSize: 14 } as const,
  rowSub: { color: '#7a818b', fontSize: 11, marginTop: 2 } as const,
};
