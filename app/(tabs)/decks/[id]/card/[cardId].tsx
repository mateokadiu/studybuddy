import { getDb } from '@/db/client';
import { type Card, cards } from '@/db/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';

async function loadCard(cardId: string): Promise<Card | null> {
  const db = getDb();
  const rows = (await db.select().from(cards).where(eq(cards.id, cardId))) as Card[];
  return rows[0] ?? null;
}

export default function CardEditorScreen() {
  const { id: deckId, cardId } = useLocalSearchParams<{ id: string; cardId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['card', cardId],
    queryFn: () => loadCard(cardId as string),
    enabled: typeof cardId === 'string',
  });

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [pageCite, setPageCite] = useState<string>('');

  useEffect(() => {
    if (q.data) {
      setFront(q.data.front);
      setBack(q.data.back);
      setPageCite(q.data.pageCite ? String(q.data.pageCite) : '');
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const db = getDb();
      const pageNum = pageCite.trim().length > 0 ? Number(pageCite) : null;
      await db
        .update(cards)
        .set({
          front: front.trim(),
          back: back.trim(),
          pageCite: pageNum,
        })
        .where(eq(cards.id, cardId as string));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] });
      qc.invalidateQueries({ queryKey: ['deck', deckId] });
      router.back();
    },
    onError: (err: unknown) => Alert.alert('save failed', String(err)),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const db = getDb();
      await db.delete(cards).where(eq(cards.id, cardId as string));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deck', deckId] });
      router.back();
    },
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
        <Text style={styles.muted}>card not found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={styles.label}>front</Text>
      <TextInput
        style={[styles.input, { minHeight: 80 }]}
        value={front}
        onChangeText={setFront}
        multiline
        placeholderTextColor="#7a818b"
      />
      <Text style={styles.label}>back</Text>
      <TextInput
        style={[styles.input, { minHeight: 80 }]}
        value={back}
        onChangeText={setBack}
        multiline
        placeholderTextColor="#7a818b"
      />
      <Text style={styles.label}>page cite</Text>
      <TextInput
        style={styles.input}
        value={pageCite}
        onChangeText={setPageCite}
        keyboardType="number-pad"
        placeholderTextColor="#7a818b"
      />

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Pressable style={styles.save} onPress={() => save.mutate()} disabled={save.isPending}>
          <Text style={styles.saveText}>{save.isPending ? 'saving…' : 'save'}</Text>
        </Pressable>
        <Pressable
          style={styles.danger}
          onPress={() =>
            Alert.alert('delete card?', 'this cannot be undone', [
              { text: 'cancel', style: 'cancel' },
              { text: 'delete', style: 'destructive', onPress: () => remove.mutate() },
            ])
          }
        >
          <Text style={styles.dangerText}>delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = {
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' } as const,
  muted: { color: '#7a818b' } as const,
  label: { color: '#7a818b', fontSize: 12, marginTop: 4 } as const,
  input: { backgroundColor: '#1a1d23', color: '#e6e8eb', padding: 10, borderRadius: 6 } as const,
  save: {
    backgroundColor: '#7aa2ff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  } as const,
  saveText: { color: '#0f1115', fontWeight: '600' } as const,
  danger: {
    borderColor: '#ff7a7a',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  } as const,
  dangerText: { color: '#ff7a7a', fontWeight: '600' } as const,
};
