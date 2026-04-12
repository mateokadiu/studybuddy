import { type ReactNode } from 'react';
import { View, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';

export type SwipeDirection = 'up' | 'right' | 'down' | 'left';

const THRESHOLD = 100;

interface Props {
  children: ReactNode;
  enabled: boolean;
  onSwipe(dir: SwipeDirection): void;
}

/**
 * Pan-handler wrapper. Maps the four cardinal swipes to FSRS grades
 * (consumer decides which → which) and shows a per-direction hint label
 * that fades in proportional to drag distance.
 */
export function SwipeCard({ children, enabled, onSwipe }: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .onUpdate((e: { translationX: number; translationY: number }) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e: { translationX: number; translationY: number }) => {
      const ax = Math.abs(e.translationX);
      const ay = Math.abs(e.translationY);
      const max = Math.max(ax, ay);
      if (max < THRESHOLD) {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
        return;
      }
      let dir: SwipeDirection;
      if (ax > ay) dir = e.translationX > 0 ? 'right' : 'left';
      else dir = e.translationY > 0 ? 'down' : 'up';
      // animate the card off-screen in that direction, then reset
      if (dir === 'right') tx.value = withTiming(500, { duration: 200 });
      if (dir === 'left') tx.value = withTiming(-500, { duration: 200 });
      if (dir === 'down') ty.value = withTiming(800, { duration: 200 });
      if (dir === 'up') ty.value = withTiming(-800, { duration: 200 });
      runOnJS(onSwipe)(dir);
      tx.value = withTiming(0, { duration: 0 });
      ty.value = withTiming(0, { duration: 0 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotateZ: `${(tx.value / 20).toFixed(2)}deg` },
    ],
  }));

  const hintUp = useAnimatedStyle(() => ({ opacity: interpolate(ty.value, [-THRESHOLD, 0], [1, 0]) }));
  const hintDown = useAnimatedStyle(() => ({ opacity: interpolate(ty.value, [0, THRESHOLD], [0, 1]) }));
  const hintLeft = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-THRESHOLD, 0], [1, 0]) }));
  const hintRight = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [0, THRESHOLD], [0, 1]) }));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.hintTop, hintUp]}>
        <Text style={styles.hintText}>good</Text>
      </Animated.View>
      <Animated.View style={[styles.hintBottom, hintDown]}>
        <Text style={[styles.hintText, { color: '#ff7a7a' }]}>again</Text>
      </Animated.View>
      <Animated.View style={[styles.hintLeft, hintLeft]}>
        <Text style={[styles.hintText, { color: '#ffb87a' }]}>hard</Text>
      </Animated.View>
      <Animated.View style={[styles.hintRight, hintRight]}>
        <Text style={[styles.hintText, { color: '#7aff9d' }]}>easy</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ width: '85%' }, cardStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = {
  hintTop: { position: 'absolute', top: 40, alignSelf: 'center' } as const,
  hintBottom: { position: 'absolute', bottom: 40, alignSelf: 'center' } as const,
  hintLeft: { position: 'absolute', left: 16, top: '50%' } as const,
  hintRight: { position: 'absolute', right: 16, top: '50%' } as const,
  hintText: { color: '#7aa2ff', fontSize: 18, fontWeight: '700' } as const,
};
