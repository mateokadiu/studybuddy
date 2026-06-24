import { Canvas, Line, Path, Skia } from '@shopify/react-native-skia';
import { Text, View } from 'react-native';

export interface RetentionPoint {
  /** days from now (0 = today). Negative = past, positive = forecast. */
  daysFromNow: number;
  /** retrievability 0..1 */
  r: number;
}

interface Props {
  /** ordered by daysFromNow ascending */
  points: RetentionPoint[];
  width: number;
  height?: number;
}

/**
 * Predicted retention curve. X = days from today, Y = average
 * retrievability of the user's review pool.
 *
 * Draws a fill-under area in muted blue + a stroke line on top + a
 * vertical "now" indicator at x=0.
 */
export function RetentionCurve({ points, width, height = 140 }: Props) {
  if (points.length === 0) {
    return (
      <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#7a818b', fontSize: 12 }}>not enough data</Text>
      </View>
    );
  }

  // domain
  const minD = points[0]!.daysFromNow;
  const maxD = points[points.length - 1]!.daysFromNow;
  const span = Math.max(1, maxD - minD);

  // y: 0..1 plotted top-down (1 at top, 0 at bottom)
  const x = (d: number) => ((d - minD) / span) * width;
  const y = (r: number) => height - r * (height - 16) - 8; // 8px padding

  // build the stroke path
  const strokePath = Skia.Path.Make();
  strokePath.moveTo(x(points[0]!.daysFromNow), y(points[0]!.r));
  for (let i = 1; i < points.length; i++) {
    strokePath.lineTo(x(points[i]!.daysFromNow), y(points[i]!.r));
  }

  // build the fill-under path (close down to bottom)
  const fillPath = Skia.Path.Make();
  fillPath.moveTo(x(points[0]!.daysFromNow), height);
  for (let i = 0; i < points.length; i++) {
    fillPath.lineTo(x(points[i]!.daysFromNow), y(points[i]!.r));
  }
  fillPath.lineTo(x(points[points.length - 1]!.daysFromNow), height);
  fillPath.close();

  const nowX = x(0);

  return (
    <View style={{ width, height }}>
      <Canvas style={{ width, height }}>
        <Path path={fillPath} color="#1e3a5f" opacity={0.6} />
        <Path path={strokePath} color="#7aa2ff" style="stroke" strokeWidth={2} />
        {nowX >= 0 && nowX <= width ? (
          <Line
            p1={{ x: nowX, y: 0 }}
            p2={{ x: nowX, y: height }}
            color="#7a818b"
            strokeWidth={1}
          />
        ) : null}
      </Canvas>
    </View>
  );
}
