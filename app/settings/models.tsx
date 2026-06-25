import { ProgressRing } from '@/components/progress-ring/ProgressRing';
import {
  type DownloadStatus,
  MODEL_CATALOG,
  type ModelSpec,
  getModelsService,
} from '@/services/models.service';
import { type LlmModelId, useSettings } from '@/stores/settings.store';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';

function fmtBytes(n: number): string {
  const gb = n / 1_000_000_000;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = n / 1_000_000;
  return `${mb.toFixed(0)} MB`;
}

export default function ModelsScreen() {
  const settings = useSettings();
  const setLlmModel = useSettings((s) => s.setLlmModel);
  const [statuses, setStatuses] = useState<Record<string, DownloadStatus>>({});

  const llms = MODEL_CATALOG.filter((m) => m.kind === 'llm');
  const embeds = MODEL_CATALOG.filter((m) => m.kind === 'embed');

  const download = async (spec: ModelSpec) => {
    try {
      await getModelsService().download(spec.id as LlmModelId, (p) => {
        setStatuses((s) => ({ ...s, [spec.id]: p.status }));
      });
    } catch (err) {
      Alert.alert('download failed', String(err));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ListHeaderComponent={<Text style={styles.section}>language model</Text>}
        data={llms}
        keyExtractor={(m, i) => `${m.id ?? 'row'}-${i}`}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => (
          <ModelRow
            spec={item}
            active={settings.llmModelId === item.id}
            status={statuses[item.id] ?? { state: 'idle' }}
            onSelect={() => setLlmModel(item.id as LlmModelId)}
            onDownload={() => download(item)}
          />
        )}
        ListFooterComponent={
          <View style={{ marginTop: 16, gap: 8 }}>
            <Text style={styles.section}>embedding model</Text>
            {embeds.map((m) => (
              <ModelRow
                key={m.id}
                spec={m}
                active={true}
                status={statuses[m.id] ?? { state: 'idle' }}
                onSelect={() => null}
                onDownload={() => download(m)}
              />
            ))}
          </View>
        }
      />
    </View>
  );
}

function ModelRow({
  spec,
  active,
  status,
  onSelect,
  onDownload,
}: {
  spec: ModelSpec;
  active: boolean;
  status: DownloadStatus;
  onSelect: () => void;
  onDownload: () => void;
}) {
  let progress = 0;
  let label = 'download';
  if (status.state === 'downloading') {
    progress = status.bytesWritten / Math.max(1, status.totalBytes);
    label = `${Math.round(progress * 100)}%`;
  } else if (status.state === 'verifying') {
    progress = 1;
    label = 'verify';
  } else if (status.state === 'installed') {
    progress = 1;
    label = 'ready';
  } else if (status.state === 'failed') {
    progress = 0;
    label = 'retry';
  }

  return (
    <Pressable onPress={onSelect} style={[styles.row, active ? styles.rowActive : null]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{spec.name}</Text>
        <Text style={styles.sub}>
          {fmtBytes(spec.sizeBytes)} · {spec.license}
        </Text>
        {status.state === 'failed' ? <Text style={styles.err}>{status.error}</Text> : null}
      </View>
      <View style={{ alignItems: 'center', gap: 4 }}>
        {status.state === 'verifying' ? (
          <ActivityIndicator />
        ) : (
          <ProgressRing progress={progress} size={44} thickness={4} label={label} />
        )}
        <Pressable onPress={onDownload} style={styles.ctaSmall}>
          <Text style={styles.ctaSmallText}>
            {status.state === 'installed' ? 'redownload' : 'download'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = {
  section: { color: '#7a818b', fontSize: 12, marginBottom: 4, paddingHorizontal: 4 } as const,
  row: {
    flexDirection: 'row',
    backgroundColor: '#1a1d23',
    padding: 12,
    borderRadius: 8,
    gap: 12,
    alignItems: 'center',
  } as const,
  rowActive: { borderColor: '#7aa2ff', borderWidth: 1 } as const,
  title: { color: '#e6e8eb', fontSize: 14, fontWeight: '600' } as const,
  sub: { color: '#7a818b', fontSize: 11, marginTop: 2 } as const,
  err: { color: '#ff7a7a', fontSize: 11, marginTop: 2 } as const,
  ctaSmall: {
    backgroundColor: '#0f1115',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  } as const,
  ctaSmallText: { color: '#7aa2ff', fontSize: 11 } as const,
};
