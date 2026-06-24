import { getDb } from '@/db/client';
import { type Deck, type Document, cards, decks, documents } from '@/db/schema';
import { useDeckStore } from '@/stores/deck.store';
import { useQuery } from '@tanstack/react-query';
import { desc, eq, sql } from 'drizzle-orm';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

interface DeckRow extends Deck {
  docTitle: string | null;
  cardCount: number;
}

async function loadDecks(): Promise<DeckRow[]> {
  const db = getDb();
  const rows = (await db
    .select({
      id: decks.id,
      docId: decks.docId,
      title: decks.title,
      generatedWithModel: decks.generatedWithModel,
      generatedWithPromptVersion: decks.generatedWithPromptVersion,
      createdAt: decks.createdAt,
      docTitle: documents.title,
    })
    .from(decks)
    .leftJoin(documents, eq(decks.docId, documents.id))
    .orderBy(desc(decks.createdAt))) as Array<Deck & { docTitle: string | null }>;

  // best-effort card counts
  const counts = (await db
    .select({ deckId: cards.deckId, n: sql<number>`count(*)` })
    .from(cards)
    .groupBy(cards.deckId)) as Array<{ deckId: string; n: number }>;
  const countMap = new Map(counts.map((c) => [c.deckId, c.n]));

  return rows.map((r) => ({ ...r, cardCount: countMap.get(r.id) ?? 0 }));
}

async function loadDocsForFilter(): Promise<Document[]> {
  const db = getDb();
  return (await db.select().from(documents).orderBy(desc(documents.importedAt))) as Document[];
}

export default function DecksScreen() {
  const router = useRouter();
  const { docId: docFilterParam } = useLocalSearchParams<{ docId?: string }>();
  const storeFilter = useDeckStore((s) => s.docFilter);
  const setFilter = useDeckStore((s) => s.setDocFilter);
  const gens = useDeckStore((s) => s.gens);

  const filter = docFilterParam ?? storeFilter;

  const decksQ = useQuery({ queryKey: ['decks'], queryFn: loadDecks, staleTime: 5_000 });
  const docsQ = useQuery({ queryKey: ['decks', 'docs'], queryFn: loadDocsForFilter });

  const rows = useMemo(() => {
    if (!decksQ.data) return [];
    return filter === 'all' ? decksQ.data : decksQ.data.filter((d) => d.docId === filter);
  }, [decksQ.data, filter]);

  if (decksQ.isPending || docsQ.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'all', title: 'all decks' } as Document, ...(docsQ.data ?? [])]}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.chip, filter === item.id ? styles.chipActive : null]}
              onPress={() => setFilter(item.id)}
            >
              <Text
                style={filter === item.id ? styles.chipTextActive : styles.chipText}
                numberOfLines={1}
              >
                {item.title}
              </Text>
            </Pressable>
          )}
          contentContainerStyle={{ gap: 8, padding: 8 }}
        />
      </View>

      {rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>no decks yet</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item }) => {
            const gen = gens[item.id];
            return (
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/(tabs)/decks/${item.id}` as never)}
              >
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.sub}>
                  {item.docTitle ?? '(no source doc)'} · {item.cardCount} cards
                </Text>
                {gen && !gen.done ? (
                  <Text style={styles.sub}>
                    generating… {gen.count}/{gen.target}
                    {gen.duplicates > 0 ? ` · ${gen.duplicates} dupes skipped` : ''}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = {
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' } as const,
  muted: { color: '#7a818b' } as const,
  filterBar: { borderBottomColor: '#1f2329', borderBottomWidth: 1 } as const,
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#1a1d23',
  } as const,
  chipActive: { backgroundColor: '#7aa2ff' } as const,
  chipText: { color: '#7a818b', fontSize: 13 } as const,
  chipTextActive: { color: '#0f1115', fontSize: 13, fontWeight: '600' } as const,
  row: { backgroundColor: '#1a1d23', padding: 12, borderRadius: 8 } as const,
  title: { color: '#e6e8eb', fontSize: 16, fontWeight: '600' } as const,
  sub: { color: '#7a818b', fontSize: 12, marginTop: 2 } as const,
};
