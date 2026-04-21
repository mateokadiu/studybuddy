import { Canvas, Rect, Group } from '@shopify/react-native-skia';
import { View, Text } from 'react-native';

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
 * GitHub-style 7-row × N-week heatmap. Each column = one ISO week; each row
 * = one day (Monday top → Sunday bottom). Draws everything in Skia for 60fps
 * panning over 5+ years of data.
 */
export function Heatmap({ days, width, cellSize = 12, gap = 3 }: Props) {
  const step = cellSize + gap;
  const rows = 7;
  const cols = Math.max(1, Math.ceil(days.length / rows));
  const height = step * rows;

  // visible weeks limited by canvas width
  const maxCols = Math.floor(width / step);
  const startCol = Math.max(0, cols - maxCols);

  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Text style={styles.title}>review heatmap</Text>
      <Canvas style={{ width, height, marginTop: 6 }}>
        <Group>
          {days.map((d, i) => {
            const col = Math.floor(i / rows);
            const row = i % rows;
            if (col < startCol) return null;
            const x = (col - startCol) * step;
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
  );
}

const styles = {
  title: { color: '#7a818b', fontSize: 12, marginBottom: 2 } as const,
};
