import { useSettings } from '@/stores/settings.store';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function SettingsHome() {
  const router = useRouter();
  const settings = useSettings();
  return (
    <View style={{ flex: 1, padding: 16, gap: 8 }}>
      <Row
        label="models"
        value={settings.llmModelId}
        onPress={() => router.push('/settings/models' as never)}
      />
      <Row
        label="storage"
        value="manage"
        onPress={() => router.push('/settings/storage' as never)}
      />
      <Row label="daily target" value={`${settings.dailyTarget} cards`} onPress={() => null} />
      <Row label="daily reminder" value={settings.dailyReviewTime} onPress={() => null} />
    </View>
  );
}

function Row({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#1a1d23',
        padding: 12,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ color: '#e6e8eb' }}>{label}</Text>
      <Text style={{ color: '#7a818b' }}>{value}</Text>
    </Pressable>
  );
}
