import { FlatList, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { cards, decks, type Card, type Deck } from '@/db/schema';
import { useDeckStore } from '@/stores/deck.store';

interface DeckDetail {
  deck: Deck;
  cards: Card[];
}

async function loadDeck(deckId: string): Promise<DeckDetail | null> {
  const db = getDb();
  const dks = (await db.select().from(decks).where(eq(decks.id, deckId))) as Deck[];
  if (dks.length === 0) return null;
  const cardRows = (await db
    .select()
    .from(cards)
    .where(eq(cards.deckId, deckId))
    .orderBy(asc(cards.due))) as Card[];
  return { deck: dks[0] as Deck, cards: cardRows };
}

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const gen = useDeckStore((s) => (typeof id === 'string' ? s.gens[id] : undefined));
  const q = useQuery({
    queryKey: ['deck', id],
    queryFn: () => loadDeck(id as string),
    enabled: typeof id === 'string',
    refetchInterval: gen && !gen.done ? 800 : false,
  });

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
        <Text style={styles.muted}>deck not found</Text>
      </View>
    );
  }

  const { deck, cards: cardRows } = q.data;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>{deck.title}</Text>
        <Text style={styles.sub}>
          {cardRows.length} cards · {deck.generatedWithModel} · {deck.generatedWithPromptVersion}
        </Text>
        {gen && !gen.done ? (
          <Text style={styles.sub}>
            generating… {gen.count}/{gen.target}
            {gen.duplicates > 0 ? ` · ${gen.duplicates} dupes` : ''}
          </Text>
        ) : null}
        <Pressable
          style={styles.cta}
          onPress={() => router.push(`/(tabs)/review/session?deckId=${deck.id}` as never)}
        >
          <Text style={styles.ctaText}>review this deck</Text>
        </Pressable>
      </View>

      <FlatList
        data={cardRows}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/(tabs)/decks/${deck.id}/card/${item.id}` as never)}
          >
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{item.type}</Text>
            </View>
            <Text style={styles.front} numberOfLines={2}>
              {item.front}
            </Text>
            <Text style={styles.back} numberOfLines={2}>
              {item.back}
            </Text>
            <Text style={styles.meta}>
              state: {item.state} · due: {new Date(item.due).toISOString().slice(0, 10)}
              {item.pageCite ? ` · p.${item.pageCite}` : ''}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.muted}>no cards yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = {
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 } as const,
  muted: { color: '#7a818b' } as const,
  header: { padding: 16, borderBottomColor: '#1f2329', borderBottomWidth: 1 } as const,
  title: { color: '#e6e8eb', fontSize: 20, fontWeight: '700' } as const,
  sub: { color: '#7a818b', fontSize: 12, marginTop: 4 } as const,
  cta: {
    marginTop: 10,
    backgroundColor: '#7aa2ff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-start',
  } as const,
  ctaText: { color: '#0f1115', fontWeight: '600' } as const,
  row: { backgroundColor: '#1a1d23', padding: 12, borderRadius: 8, gap: 4 } as const,
  typeBadge: { alignSelf: 'flex-start', backgroundColor: '#0f1115', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 } as const,
  typeBadgeText: { color: '#7aa2ff', fontSize: 10, textTransform: 'uppercase' } as const,
  front: { color: '#e6e8eb', fontSize: 15, fontWeight: '600' } as const,
  back: { color: '#9aa0a8', fontSize: 13 } as const,
  meta: { color: '#7a818b', fontSize: 11 } as const,
};
