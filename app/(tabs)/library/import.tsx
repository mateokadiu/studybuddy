import { useState } from 'react';
import { Pressable, Text, View, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { id as uuid } from '@/lib/id';
import { getDb } from '@/db/client';
import { documents } from '@/db/schema';
import { useLibrary as useLibraryStore } from '@/stores/library.store';
import { ingestPdf, ingestPastedText } from '@/services/ingest';

type Mode = 'pick' | 'paste';

export default function ImportScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const startIngest = useLibraryStore((s) => s.startIngest);
  const [mode, setMode] = useState<Mode>('pick');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');

  const pick = useMutation({
    mutationFn: async () => {
      const picker = require('expo-document-picker') as {
        getDocumentAsync(opts: {
          type?: string | string[];
          copyToCacheDirectory?: boolean;
        }): Promise<{ canceled: boolean; assets?: Array<{ uri: string; name: string; size?: number }> }>;
      };
      const res = await picker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return null;
      const asset = res.assets[0];
      const docId = uuid();
      const db = getDb();
      await db.insert(documents).values({
        id: docId,
        title: asset.name.replace(/\.pdf$/i, ''),
        source: 'pdf',
        filePath: asset.uri,
        pageCount: 0,
        charCount: 0,
        status: 'ingesting',
        importedAt: new Date(),
      });
      startIngest(docId);
      void ingestPdf(docId, asset.uri).catch((err: unknown) => {
        Alert.alert('ingest failed', String(err));
      });
      qc.invalidateQueries({ queryKey: ['library'] });
      return docId;
    },
    onSuccess: (docId) => {
      if (docId) router.replace(`/(tabs)/library/${docId}` as never);
    },
  });

  const paste = useMutation({
    mutationFn: async () => {
      if (pasteText.trim().length === 0) throw new Error('paste some text first');
      const docId = uuid();
      const db = getDb();
      const title = pasteTitle.trim().length > 0 ? pasteTitle.trim() : `paste ${new Date().toISOString().slice(0, 10)}`;
      await db.insert(documents).values({
        id: docId,
        title,
        source: 'paste',
        filePath: null,
        pageCount: 1,
        charCount: pasteText.length,
        status: 'ingesting',
        importedAt: new Date(),
      });
      startIngest(docId);
      void ingestPastedText(docId, pasteText).catch((err: unknown) => {
        Alert.alert('ingest failed', String(err));
      });
      qc.invalidateQueries({ queryKey: ['library'] });
      return docId;
    },
    onSuccess: (docId) => {
      if (docId) router.replace(`/(tabs)/library/${docId}` as never);
    },
  });

  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ModeChip active={mode === 'pick'} label="pick pdf" onPress={() => setMode('pick')} />
        <ModeChip active={mode === 'paste'} label="paste text" onPress={() => setMode('paste')} />
      </View>

      {mode === 'pick' ? (
        <View style={{ gap: 12 }}>
          <Text style={styles.muted}>choose a pdf from your device. it stays on-device.</Text>
          <Pressable style={styles.cta} onPress={() => pick.mutate()} disabled={pick.isPending}>
            <Text style={styles.ctaText}>{pick.isPending ? 'opening picker…' : 'pick pdf'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <TextInput
            style={styles.input}
            placeholder="title (optional)"
            placeholderTextColor="#7a818b"
            value={pasteTitle}
            onChangeText={setPasteTitle}
          />
          <TextInput
            style={[styles.input, { minHeight: 200 }]}
            placeholder="paste your text here…"
            placeholderTextColor="#7a818b"
            value={pasteText}
            onChangeText={setPasteText}
            multiline
          />
          <Pressable style={styles.cta} onPress={() => paste.mutate()} disabled={paste.isPending}>
            <Text style={styles.ctaText}>{paste.isPending ? 'ingesting…' : 'ingest'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ModeChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, active ? styles.chipActive : null]}
      onPress={onPress}
    >
      <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = {
  muted: { color: '#7a818b' } as const,
  cta: {
    backgroundColor: '#7aa2ff',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  } as const,
  ctaText: { color: '#0f1115', fontWeight: '600' } as const,
  input: {
    backgroundColor: '#1a1d23',
    color: '#e6e8eb',
    padding: 12,
    borderRadius: 8,
  } as const,
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#1a1d23',
  } as const,
  chipActive: { backgroundColor: '#7aa2ff' } as const,
  chipText: { color: '#7a818b' } as const,
  chipTextActive: { color: '#0f1115', fontWeight: '600' } as const,
};
