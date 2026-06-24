import { getDb } from '@/db/client';
import { documents } from '@/db/schema';
import { id as uuid } from '@/lib/id';
import { ingestPdf } from '@/services/ingest';
import { useLibrary } from '@/stores/library.store';
import { useSettings } from '@/stores/settings.store';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

const SAMPLE_URI = require('../../assets/sample.pdf');

export default function OnboardingSample() {
  const router = useRouter();
  const complete = useSettings((s) => s.completeOnboarding);
  const startIngest = useLibrary((s) => s.startIngest);

  const importSample = async () => {
    const docId = uuid();
    const db = getDb();
    await db.insert(documents).values({
      id: docId,
      title: 'Sample · Spaced Repetition Primer',
      source: 'pdf',
      filePath: typeof SAMPLE_URI === 'string' ? SAMPLE_URI : 'bundle:sample.pdf',
      pageCount: 4,
      charCount: 0,
      status: 'ingesting',
      importedAt: new Date(),
    });
    startIngest(docId);
    void ingestPdf(docId, typeof SAMPLE_URI === 'string' ? SAMPLE_URI : 'bundle:sample.pdf');
    complete();
    router.replace('/(tabs)/library' as never);
  };

  return (
    <View style={styles.host}>
      <Text style={styles.h2}>try it</Text>
      <Text style={styles.body}>
        a sample pdf is bundled with the app. import it now to see ingest → cards → review → chat
        without picking a file.
      </Text>
      <Pressable style={styles.cta} onPress={importSample}>
        <Text style={styles.ctaText}>import sample</Text>
      </Pressable>
      <Text style={styles.muted}>
        prefer your own pdf? skip — import any pdf from the library tab and the rest of the app
        lights up.
      </Text>
      <View style={{ flex: 1 }} />
      <Pressable
        style={styles.ctaOutline}
        onPress={() => {
          complete();
          router.replace('/(tabs)/library' as never);
        }}
      >
        <Text style={styles.ctaOutlineText}>skip — open library</Text>
      </Pressable>
    </View>
  );
}

const styles = {
  host: { flex: 1, padding: 24, gap: 16, backgroundColor: '#0f1115' } as const,
  h2: { color: '#e6e8eb', fontSize: 28, fontWeight: '700' } as const,
  body: { color: '#e6e8eb', fontSize: 14 } as const,
  muted: { color: '#7a818b', fontSize: 13 } as const,
  cta: {
    backgroundColor: '#7aa2ff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  } as const,
  ctaText: { color: '#0f1115', fontWeight: '700' } as const,
  ctaOutline: {
    borderColor: '#7aa2ff',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  } as const,
  ctaOutlineText: { color: '#7aa2ff', fontWeight: '600' } as const,
};
