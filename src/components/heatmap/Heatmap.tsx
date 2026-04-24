import { useState } from 'react';
import { Canvas, Rect, Group } from '@shopify/react-native-skia';
import { View, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, withSpring, runOnJS } from 'react-native-reanimated';

export interface HeatmapDay {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** review count for that day */
  count: number;
}

interface Props {
  /** ordered list, oldest -> newest; one entry per day. fills gaps with 0. */
  days: HeatmapDay[];
  /** total width in pixels (the canvas will be width × cellSize*7) */
  width: number;
  /** cell side (default 12) */
  cellSize?: number;
  /** spacing between cells (default 3) */
  gap?: number;
}

const PALETTE = ['#1a1d23', '#1e3a5f', '#2b5e8a', '#4a86c2', '#7aa2ff'] as const;

function bucket(count: number): number {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 10) return 2;
  if (count <= 20) return 3;
  return 4;
}

/**
 * GitHub-style 7-row × N-week heatmap with horizontal pan.
 *
 * Each column = one ISO week; each row = one day (Mon top → Sun bottom).
 * The pan gesture shifts the visible window over the underlying date
 * range — only cells inside the canvas viewport are drawn ("virtualization"
 * in skia is just don't-emit-the-Rect).
 */
export function Heatmap({ days, width, cellSize = 12, gap = 3 }: Props) {
  const step = cellSize + gap;
  const rows = 7;
  const totalCols = Math.max(1, Math.ceil(days.length / rows));
  const height = step * rows;

  const maxCols = Math.floor(width / step);
  const maxScroll = Math.max(0, (totalCols - maxCols) * step);

  // pan offset (-maxScroll <= offset <= 0). Negative = scrolled into older
  // months (further left along x).
  const offset = useSharedValue(0);
  const offsetStart = useSharedValue(0);

  // mirror the offset into JS state at 60fps for the cell-emit pass below.
  const [scrollPx, setScrollPx] = useState(0);
  useDerivedValue(() => {
    runOnJS(setScrollPx)(offset.value);
  });

  const pan = Gesture.Pan()
    .onUpdate((e: { translationX: number }) => {
      const next = offsetStart.value + e.translationX;
      offset.value = Math.max(-maxScroll, Math.min(0, next));
    })
    .onEnd(() => {
      offsetStart.value = offset.value;
      offset.value = withSpring(offset.value, { damping: 18 });
    });

  // which columns are currently visible?
  const firstVisibleCol = Math.max(0, Math.floor(-scrollPx / step));
  const lastVisibleCol = Math.min(totalCols - 1, firstVisibleCol + maxCols + 1);

  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Text style={styles.title}>review heatmap</Text>
      <GestureDetector gesture={pan}>
        <View style={{ width, height, overflow: 'hidden' }}>
          <Canvas style={{ width, height }}>
            <Group transform={[{ translateX: scrollPx }]}>
              {days.map((d, i) => {
                const col = Math.floor(i / rows);
                if (col < firstVisibleCol || col > lastVisibleCol) return null;
                const row = i % rows;
                const x = col * step;
                const y = row * step;
                const color = PALETTE[bucket(d.count)] as string;
                return (
                  <Rect
                    key={d.date}
                    x={x}
                    y={y}
                    width={cellSize}
                    height={cellSize}
                    color={color}
                  />
                );
              })}
            </Group>
          </Canvas>
        </View>
      </GestureDetector>
      <Text style={styles.hint}>pan horizontally to see older months</Text>
    </View>
  );
}

const styles = {
  title: { color: '#7a818b', fontSize: 12, marginBottom: 2 } as const,
  hint: { color: '#7a818b', fontSize: 10, marginTop: 4 } as const,
};
