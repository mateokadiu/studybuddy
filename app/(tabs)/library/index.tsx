import { useLibrary } from '@/hooks/use-library';
import { useLibrary as useLibraryStore } from '@/stores/library.store';
import { Link, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

export default function LibraryScreen() {
  const router = useRouter();
  const q = useLibrary();
  const sort = useLibraryStore((s) => s.sort);
  const filter = useLibraryStore((s) => s.filterStatus);
  const ingests = useLibraryStore((s) => s.ingests);

  const rows = useMemo(() => {
    if (!q.data) return [];
    let r = q.data;
    if (filter !== 'all') r = r.filter((d) => d.status === filter);
    if (sort === 'title') r = [...r].sort((a, b) => a.title.localeCompare(b.title));
    return r;
  }, [q.data, sort, filter]);

  if (q.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>your library is empty</Text>
        <Link href="/(tabs)/library/import" asChild>
          <Pressable style={styles.cta}>
            <Text style={styles.ctaText}>import a pdf</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(d, i) => `${d.id ?? 'row'}-${i}`}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => {
          const ingest = ingests[item.id];
          return (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/(tabs)/library/${item.id}` as never)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.sub}>
                  {item.status} · {item.pageCount} pp · {Math.round(item.charCount / 1000)}k chars
                </Text>
                {ingest && ingest.stage !== 'done' ? (
                  <Text style={styles.sub}>
                    {ingest.stage}: {ingest.stageDone}/{ingest.stageTotal}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
      <Link href="/(tabs)/library/import" asChild>
        <Pressable style={styles.fab}>
          <Text style={styles.fabText}>+ pdf</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = {
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 } as const,
  muted: { color: '#7a818b', fontSize: 14 } as const,
  cta: {
    backgroundColor: '#7aa2ff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  } as const,
  ctaText: { color: '#0f1115', fontWeight: '600' } as const,
  row: { backgroundColor: '#1a1d23', padding: 12, borderRadius: 8 } as const,
  title: { color: '#e6e8eb', fontSize: 16, fontWeight: '600' } as const,
  sub: { color: '#7a818b', fontSize: 12, marginTop: 2 } as const,
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#7aa2ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  } as const,
  fabText: { color: '#0f1115', fontWeight: '700' } as const,
};
