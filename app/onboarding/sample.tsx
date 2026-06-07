import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSettings } from '@/stores/settings.store';

export default function OnboardingSample() {
  const router = useRouter();
  const complete = useSettings((s) => s.completeOnboarding);
  return (
    <View style={styles.host}>
      <Text style={styles.h2}>try it</Text>
      <Text style={styles.body}>
        a sample pdf is bundled with the app. import it from the library tab to
        see ingest → cards → review → chat without picking a file.
      </Text>
      <Text style={styles.muted}>
        prefer your own pdf? skip the sample. import any pdf from the library tab
        and the rest of the app lights up.
      </Text>
      <View style={{ flex: 1 }} />
      <Pressable
        style={styles.cta}
        onPress={() => {
          complete();
          router.replace('/(tabs)/library' as never);
        }}
      >
        <Text style={styles.ctaText}>open library</Text>
      </Pressable>
    </View>
  );
}

const styles = {
  host: { flex: 1, padding: 24, gap: 16, backgroundColor: '#0f1115' } as const,
  h2: { color: '#e6e8eb', fontSize: 28, fontWeight: '700' } as const,
  body: { color: '#e6e8eb', fontSize: 14 } as const,
  muted: { color: '#7a818b', fontSize: 13 } as const,
  cta: { backgroundColor: '#7aa2ff', paddingVertical: 14, borderRadius: 8, alignItems: 'center' } as const,
  ctaText: { color: '#0f1115', fontWeight: '700' } as const,
};
