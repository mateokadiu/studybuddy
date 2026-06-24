import { useSettings } from '@/stores/settings.store';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function OnboardingModels() {
  const router = useRouter();
  const wifiOnly = useSettings((s) => s.wifiOnlyDownloads);
  const setWifi = useSettings((s) => s.setWifiOnly);
  return (
    <View style={styles.host}>
      <Text style={styles.h2}>models</Text>
      <Text style={styles.body}>studybuddy uses two on-device models:</Text>
      <View style={{ gap: 8 }}>
        <Bullet text="Llama 3.2 3B (4-bit) — generates flashcards + chat answers (~2.5 GB)" />
        <Bullet text="MiniLM-L6 — embeds chunks for retrieval (~25 MB)" />
      </View>
      <Text style={styles.muted}>
        downloaded once on first launch. stored under your app sandbox. you can swap for Phi-3.5,
        Gemma 2, or Llama 1B later in settings.
      </Text>
      <Pressable style={styles.toggle} onPress={() => setWifi(!wifiOnly)}>
        <Text style={styles.toggleText}>wifi-only downloads: {wifiOnly ? 'on' : 'off'}</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      <Pressable style={styles.cta} onPress={() => router.push('/onboarding/sample' as never)}>
        <Text style={styles.ctaText}>continue</Text>
      </Pressable>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={{ color: '#7aa2ff' }}>·</Text>
      <Text style={{ color: '#e6e8eb', flex: 1 }}>{text}</Text>
    </View>
  );
}

const styles = {
  host: { flex: 1, padding: 24, gap: 16, backgroundColor: '#0f1115' } as const,
  h2: { color: '#e6e8eb', fontSize: 28, fontWeight: '700' } as const,
  body: { color: '#e6e8eb', fontSize: 14 } as const,
  muted: { color: '#7a818b', fontSize: 13 } as const,
  toggle: { backgroundColor: '#1a1d23', padding: 12, borderRadius: 8 } as const,
  toggleText: { color: '#e6e8eb' } as const,
  cta: {
    backgroundColor: '#7aa2ff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  } as const,
  ctaText: { color: '#0f1115', fontWeight: '700' } as const,
};
