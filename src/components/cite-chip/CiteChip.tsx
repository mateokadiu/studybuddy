import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

interface Props {
  /** chunk id this citation maps to, or '' if the cite is unresolved */
  chunkId: string;
  /** 1-indexed page */
  page: number;
  /** override default tap behavior */
  onPress?: () => void;
  /** small (in chat) or medium (standalone) — affects padding + font */
  size?: 'sm' | 'md';
}

/**
 * Tappable page citation chip.
 *
 * Default behavior on tap: navigate to the source doc detail screen
 * with a chunk anchor — wired to scroll the right chunk into view in
 * commit 56.
 *
 * Unresolved chips (no chunkId, e.g. the model hallucinated a page) get
 * a different border so the user can see they won't navigate anywhere.
 */
export function CiteChip({ chunkId, page, onPress, size = 'sm' }: Props) {
  const router = useRouter();
  const resolved = chunkId.length > 0;
  const dims =
    size === 'sm'
      ? { paddingHorizontal: 8, paddingVertical: 2, fontSize: 11, borderRadius: 12 }
      : { paddingHorizontal: 10, paddingVertical: 4, fontSize: 13, borderRadius: 14 };
  return (
    <Pressable
      hitSlop={6}
      onPress={() => {
        if (onPress) onPress();
        else if (resolved) {
          // route to the source doc detail with the chunk id as a query
          // param; the detail screen scrolls that chunk into view.
          router.push(`/(tabs)/library?focusChunkId=${chunkId}` as never);
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={`source citation, page ${page}`}
      style={{
        backgroundColor: resolved ? '#0f1115' : 'transparent',
        borderColor: resolved ? 'transparent' : '#7a818b',
        borderWidth: resolved ? 0 : 1,
        borderRadius: dims.borderRadius,
        paddingHorizontal: dims.paddingHorizontal,
        paddingVertical: dims.paddingVertical,
      }}
    >
      <Text
        style={{
          color: resolved ? '#7aa2ff' : '#7a818b',
          fontSize: dims.fontSize,
          fontWeight: '600',
        }}
      >
        p.{page}
        {resolved ? '' : ' ?'}
      </Text>
    </Pressable>
  );
}
