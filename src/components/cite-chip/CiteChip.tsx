import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';

interface Props {
  chunkId: string;
  page: number;
}

/**
 * Tappable page citation. Tap scrolls the source doc view to the cited
 * chunk — wired in commit 56.
 */
export function CiteChip({ chunkId, page }: Props) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => {
        if (chunkId) router.push(`/(tabs)/library/${chunkId}#chunk` as never);
      }}
      style={{
        backgroundColor: '#0f1115',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: '#7aa2ff', fontSize: 11 }}>p.{page}</Text>
    </Pressable>
  );
}
