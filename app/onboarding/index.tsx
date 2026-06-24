import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.host}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <Text style={styles.h1}>studybuddy</Text>
        <Text style={styles.lede}>drop in a pdf. get flashcards and chat with the doc.</Text>
        <Text style={styles.muted}>everything runs on your phone. nothing leaves the device.</Text>
      </View>
      <Pressable style={styles.cta} onPress={() => router.push('/onboarding/models' as never)}>
        <Text style={styles.ctaText}>continue</Text>
      </Pressable>
    </View>
  );
}

const styles = {
  host: { flex: 1, padding: 24, backgroundColor: '#0f1115' } as const,
  h1: { color: '#e6e8eb', fontSize: 40, fontWeight: '700' } as const,
  lede: { color: '#e6e8eb', fontSize: 18 } as const,
  muted: { color: '#7a818b', fontSize: 14 } as const,
  cta: {
    backgroundColor: '#7aa2ff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  } as const,
  ctaText: { color: '#0f1115', fontWeight: '700' } as const,
};
