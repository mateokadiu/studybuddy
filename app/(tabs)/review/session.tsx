import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { eq, asc, and, lte } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { cards, type Card } from '@/db/schema';
import { useReview } from '@/stores/review.store';
import { useSettings } from '@/stores/settings.store';
import { Card as Flashcard } from '@/components/card/Card';
import { SwipeCard, type SwipeDirection } from '@/components/card/SwipeCard';
import { gradeCard } from '@/services/grade.service';

const DIR_TO_RATING: Record<SwipeDirection, 1 | 2 | 3 | 4> = {
  down: 1, // again
  left: 2, // hard
  up: 3, // good
  right: 4, // easy
};

async function loadDueCards(deckId: string | null, limit: number): Promise<Card[]> {
  const db = getDb();
  const now = new Date();
  const where = deckId
    ? and(eq(cards.deckId, deckId), lte(cards.due, now))
    : lte(cards.due, now);
  const rows = (await db.select().from(cards).where(where).orderBy(asc(cards.due)).limit(limit)) as Card[];
  return rows;
}

export default function ReviewSessionScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const router = useRouter();
  const dailyTarget = useSettings((s) => s.dailyTarget);
  const session = useReview((s) => s.session);
  const flipped = useReview((s) => s.flipped);
  const startSession = useReview((s) => s.startSession);
  const flip = useReview((s) => s.flip);
  const grade = useReview((s) => s.grade);

  const q = useQuery({
    queryKey: ['review', deckId ?? 'all', dailyTarget],
    queryFn: () => loadDueCards(deckId ?? null, dailyTarget),
  });

  const flippedAt = useRef<number | null>(null);
  const [head, setHead] = useState<Card | null>(null);

  useEffect(() => {
    if (q.data && !session) {
      startSession({ deckId: deckId ?? null, queue: q.data.map((c) => c.id) });
    }
  }, [q.data, session, startSession, deckId]);

  useEffect(() => {
    if (!session) return;
    const id = session.queue[0];
    if (!id) {
      setHead(null);
      return;
    }
    if (q.data) {
      const card = q.data.find((c) => c.id === id);
      setHead(card ?? null);
    }
  }, [session, q.data]);

  useEffect(() => {
    if (flipped) flippedAt.current = Date.now();
  }, [flipped]);

  if (q.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!head) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>nothing due. nice work.</Text>
        <Pressable
          style={styles.cta}
          onPress={() => router.replace(`/(tabs)/review/done` as never)}
        >
          <Text style={styles.ctaText}>see summary</Text>
        </Pressable>
      </View>
    );
  }

  const handleSwipe = async (dir: SwipeDirection) => {
    if (!flipped) {
      // require flip before grading
      flip();
      return;
    }
    const rating = DIR_TO_RATING[dir];
    const duration = flippedAt.current ? Date.now() - flippedAt.current : 0;
    grade(head.id, rating, duration);
    try {
      await gradeCard(head.id, rating, duration);
    } catch {
      // ignore — store has already advanced; next launch reconciles
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.headerBar}>
        <Text style={styles.headerText}>
          {(session?.done.length ?? 0)} / {(session?.queue.length ?? 0) + (session?.done.length ?? 0)}
        </Text>
      </View>
      <SwipeCard enabled={true} onSwipe={handleSwipe}>
        <Flashcard
          front={head.front}
          back={head.back}
          type={head.type as 'cloze' | 'recall' | 'qa'}
          pageCite={head.pageCite}
          flipped={flipped}
          onFlip={flip}
        />
      </SwipeCard>
      <View style={styles.legend}>
        <Text style={styles.legendText}>tap to flip · swipe to grade</Text>
        <Text style={styles.legendSub}>↑ good · ↓ again · ← hard · → easy</Text>
      </View>
    </View>
  );
}

const styles = {
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 } as const,
  empty: { color: '#e6e8eb', fontSize: 16 } as const,
  cta: { backgroundColor: '#7aa2ff', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 } as const,
  ctaText: { color: '#0f1115', fontWeight: '600' } as const,
  headerBar: { padding: 12, borderBottomColor: '#1f2329', borderBottomWidth: 1, alignItems: 'center' } as const,
  headerText: { color: '#e6e8eb', fontSize: 14 } as const,
  legend: { paddingVertical: 12, alignItems: 'center' } as const,
  legendText: { color: '#9aa0a8', fontSize: 12 } as const,
  legendSub: { color: '#7a818b', fontSize: 11, marginTop: 2 } as const,
};
