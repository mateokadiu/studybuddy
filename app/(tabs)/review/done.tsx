import { useMemo } from 'react';
import { Dimensions, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { cards, type Card } from '@/db/schema';
import { useReview } from '@/stores/review.store';
import { RetentionCurve, type RetentionPoint } from '@/components/retention-curve/RetentionCurve';
import { retrievability } from '@/lib/fsrs';

async function loadAllCards(): Promise<Card[]> {
  const db = getDb();
  return (await db.select().from(cards)) as Card[];
}

/** Build a forecast curve of mean retention over the next N days. */
function buildForecast(cards: Card[], horizonDays = 60): RetentionPoint[] {
  if (cards.length === 0) return [];
  const now = Date.now();
  const DAY = 86_400_000;
  const points: RetentionPoint[] = [];
  for (let d = 0; d <= horizonDays; d += 2) {
    const t = now + d * DAY;
    let sum = 0;
    for (const c of cards) {
      sum += retrievability(
        {
          stability: c.stability,
          difficulty: c.difficulty,
          elapsedDays: c.elapsedDays,
          scheduledDays: c.scheduledDays,
          reps: c.reps,
          lapses: c.lapses,
          state: c.state as 'new' | 'learning' | 'review' | 'relearning',
          due: c.due.getTime(),
          lastReview: c.lastReview ? c.lastReview.getTime() : null,
        },
        t,
      );
    }
    points.push({ daysFromNow: d, r: sum / cards.length });
  }
  return points;
}

export default function ReviewDoneScreen() {
  const router = useRouter();
  const session = useReview((s) => s.session);
  const abort = useReview((s) => s.abort);
  const width = Dimensions.get('window').width - 32;

  const cardsQ = useQuery({ queryKey: ['all-cards'], queryFn: loadAllCards });
  const points = useMemo(() => (cardsQ.data ? buildForecast(cardsQ.data) : []), [cardsQ.data]);

  const totals = useMemo(() => {
    if (!session) return null;
    const grades = Object.values(session.ratings);
    return {
      n: session.done.length,
      again: grades.filter((g) => g === 1).length,
      hard: grades.filter((g) => g === 2).length,
      good: grades.filter((g) => g === 3).length,
      easy: grades.filter((g) => g === 4).length,
      elapsed: Math.max(1, Date.now() - session.startedAt),
    };
  }, [session]);

  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Text style={styles.title}>session complete</Text>
      {totals ? (
        <View style={styles.statsRow}>
          <Stat label="cards" value={String(totals.n)} />
          <Stat label="again" value={String(totals.again)} />
          <Stat label="hard" value={String(totals.hard)} />
          <Stat label="good" value={String(totals.good)} />
          <Stat label="easy" value={String(totals.easy)} />
        </View>
      ) : null}

      <Text style={styles.section}>retention forecast (next 60 days)</Text>
      {cardsQ.isPending ? (
        <ActivityIndicator />
      ) : (
        <RetentionCurve points={points} width={width} />
      )}

      <Pressable
        style={styles.cta}
        onPress={() => {
          abort();
          router.replace(`/(tabs)/review` as never);
        }}
      >
        <Text style={styles.ctaText}>done</Text>
      </Pressable>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = {
  title: { color: '#e6e8eb', fontSize: 22, fontWeight: '700' } as const,
  section: { color: '#7a818b', fontSize: 12, marginTop: 8 } as const,
  statsRow: { flexDirection: 'row', gap: 8 } as const,
  stat: { backgroundColor: '#1a1d23', padding: 10, borderRadius: 8, alignItems: 'center', flex: 1 } as const,
  statValue: { color: '#e6e8eb', fontSize: 18, fontWeight: '700' } as const,
  statLabel: { color: '#7a818b', fontSize: 10, marginTop: 2 } as const,
  cta: {
    marginTop: 'auto',
    backgroundColor: '#7aa2ff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  } as const,
  ctaText: { color: '#0f1115', fontWeight: '700' } as const,
};
