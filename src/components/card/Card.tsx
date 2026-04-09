import { Pressable, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';

export interface CardProps {
  front: string;
  back: string;
  type: 'cloze' | 'recall' | 'qa';
  pageCite?: number | null;
  flipped: boolean;
  onFlip: () => void;
}

/**
 * Flashcard with a 3D Y-axis flip driven by reanimated 4.
 *
 * The front and back live in the same parent and use `backfaceVisibility:
 * hidden` so only one is visible at a time. We rotate the back +180° so its
 * natural rendering aligns when the parent rotates from 0 → 180.
 */
export function Card({ front, back, type, pageCite, flipped, onFlip }: CardProps) {
  const rotate = useSharedValue(0);

  useEffect(() => {
    rotate.value = withTiming(flipped ? 180 : 0, {
      duration: 350,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    });
  }, [flipped, rotate]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${rotate.value}deg` }],
    opacity: interpolate(rotate.value, [0, 89, 90, 180], [1, 1, 0, 0]),
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${rotate.value - 180}deg` }],
    opacity: interpolate(rotate.value, [0, 89, 90, 180], [0, 0, 1, 1]),
  }));

  return (
    <Pressable onPress={onFlip} style={styles.host}>
      <Animated.View style={[styles.face, frontStyle]}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{type}</Text>
        </View>
        <Text style={styles.text}>{front}</Text>
        {pageCite ? <Text style={styles.meta}>p.{pageCite}</Text> : null}
      </Animated.View>
      <Animated.View style={[styles.face, styles.faceBack, backStyle]}>
        <Text style={styles.text}>{back}</Text>
        {pageCite ? <Text style={styles.meta}>p.{pageCite}</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = {
  host: {
    width: '100%',
    aspectRatio: 0.7,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  face: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1d23',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  } as const,
  faceBack: { backgroundColor: '#161920' } as const,
  typeBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: '#0f1115', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 } as const,
  typeBadgeText: { color: '#7aa2ff', fontSize: 10, textTransform: 'uppercase' } as const,
  text: { color: '#e6e8eb', fontSize: 20, textAlign: 'center' } as const,
  meta: { position: 'absolute', bottom: 12, right: 16, color: '#7a818b', fontSize: 11 } as const,
};
