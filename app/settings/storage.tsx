import { useState } from 'react';
import { FlatList, Pressable, Text, View, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { cards, chatMessages, chunks, decks, documents, reviews } from '@/db/schema';
import { kvClearAll } from '@/lib/mmkv';

interface DocBreakdown {
  id: string;
  title: string;
  chunkCount: number;
  cardCount: number;
  estimateBytes: number;
}

async function loadBreakdown(): Promise<DocBreakdown[]> {
  const db = getDb();
  // chunks
  const chunkRows = (await db
    .select({ docId: chunks.docId, n: sql<number>`count(*)`, charSum: sql<number>`coalesce(sum(length(text)), 0)` })
    .from(chunks)
    .groupBy(chunks.docId)) as Array<{ docId: string; n: number; charSum: number }>;
  const cardCounts = (await db
    .select({ deckId: cards.deckId, n: sql<number>`count(*)` })
    .from(cards)
    .groupBy(cards.deckId)) as Array<{ deckId: string; n: number }>;
  const deckRows = (await db.select().from(decks)) as Array<{ id: string; docId: string | null }>;
  const docs = (await db.select().from(documents)) as Array<{ id: string; title: string }>;

  const chunkMap = new Map<string, { n: number; charSum: number }>();
  for (const r of chunkRows) chunkMap.set(r.docId, { n: r.n, charSum: r.charSum });
  const cardMap = new Map<string, number>();
  for (const r of cardCounts) cardMap.set(r.deckId, r.n);
  const docCards = new Map<string, number>();
  for (const d of deckRows) {
    if (!d.docId) continue;
    const c = cardMap.get(d.id) ?? 0;
    docCards.set(d.docId, (docCards.get(d.docId) ?? 0) + c);
  }

  return docs.map((d) => {
    const ck = chunkMap.get(d.id) ?? { n: 0, charSum: 0 };
    // embedding bytes: 384 * 4 = 1536 per chunk; text bytes ~= charSum
    const estimateBytes = ck.n * 1536 + ck.charSum;
    return {
      id: d.id,
      title: d.title,
      chunkCount: ck.n,
      cardCount: docCards.get(d.id) ?? 0,
      estimateBytes,
    };
  });
}

export default function StorageScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['storage'], queryFn: loadBreakdown });
  const [wipeStage, setWipeStage] = useState<0 | 1 | 2>(0);

  const wipe = async () => {
    const db = getDb();
    await db.delete(reviews);
    await db.delete(cards);
    await db.delete(decks);
    await db.delete(chatMessages);
    await db.delete(chunks);
    await db.delete(documents);
    kvClearAll();
    qc.invalidateQueries({ queryKey: ['storage'] });
    qc.invalidateQueries({ queryKey: ['library'] });
    setWipeStage(0);
  };

  if (q.isPending) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  const total = (q.data ?? []).reduce((a, d) => a + d.estimateBytes, 0);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.summary}>
        <Text style={styles.summaryNum}>{(total / 1_000_000).toFixed(1)} MB</Text>
        <Text style={styles.summaryLabel}>across {q.data?.length ?? 0} docs</Text>
      </View>

      <FlatList
        data={q.data}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.sub}>
              {item.chunkCount} chunks · {item.cardCount} cards · {(item.estimateBytes / 1_000_000).toFixed(1)} MB
            </Text>
          </View>
        )}
      />

      <View style={styles.danger}>
        <Text style={styles.dangerTitle}>danger zone</Text>
        <Text style={styles.dangerSub}>
          wipe everything — documents, chunks, decks, cards, reviews, chats, settings.
        </Text>
        {wipeStage === 0 ? (
          <Pressable style={styles.dangerBtn} onPress={() => setWipeStage(1)}>
            <Text style={styles.dangerBtnText}>wipe all data</Text>
          </Pressable>
        ) : wipeStage === 1 ? (
          <Pressable
            style={styles.dangerBtn}
            onPress={() => {
              setWipeStage(2);
              Alert.alert('really wipe?', 'this cannot be undone', [
                { text: 'cancel', style: 'cancel', onPress: () => setWipeStage(0) },
                { text: 'wipe', style: 'destructive', onPress: () => wipe() },
              ]);
            }}
          >
            <Text style={styles.dangerBtnText}>tap again to confirm</Text>
          </Pressable>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    </View>
  );
}

const styles = {
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' } as const,
  summary: { padding: 16, alignItems: 'center', borderBottomColor: '#1f2329', borderBottomWidth: 1 } as const,
  summaryNum: { color: '#e6e8eb', fontSize: 28, fontWeight: '700' } as const,
  summaryLabel: { color: '#7a818b', fontSize: 12, marginTop: 4 } as const,
  row: { backgroundColor: '#1a1d23', padding: 10, borderRadius: 6 } as const,
  title: { color: '#e6e8eb', fontSize: 14 } as const,
  sub: { color: '#7a818b', fontSize: 11, marginTop: 2 } as const,
  danger: { padding: 16, borderTopColor: '#1f2329', borderTopWidth: 1, gap: 8 } as const,
  dangerTitle: { color: '#ff7a7a', fontSize: 14, fontWeight: '700' } as const,
  dangerSub: { color: '#7a818b', fontSize: 12 } as const,
  dangerBtn: { borderColor: '#ff7a7a', borderWidth: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' } as const,
  dangerBtnText: { color: '#ff7a7a', fontWeight: '600' } as const,
};
