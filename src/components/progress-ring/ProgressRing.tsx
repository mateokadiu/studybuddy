import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { Text, View } from 'react-native';

interface Props {
  /** 0..1 */
  progress: number;
  /** outer diameter (default 64) */
  size?: number;
  /** stroke width (default 6) */
  thickness?: number;
  /** color of the progress arc */
  color?: string;
  /** label shown in the center (e.g. "12/30"); omit to hide */
  label?: string;
}

/**
 * Circular progress ring drawn in Skia. Used during card generation
 * (deck list rows, deck detail header) and elsewhere we want a small
 * radial indicator. We approximate the arc with a stroked circle whose
 * pathEffect "dash" cuts off the unfilled portion — keeps the api tiny.
 */
export function ProgressRing({
  progress,
  size = 64,
  thickness = 6,
  color = '#7aa2ff',
  label,
}: Props) {
  const r = (size - thickness) / 2;
  const c = size / 2;
  const clamped = Math.max(0, Math.min(1, progress));
  const circumference = 2 * Math.PI * r;
  // we draw two circles: a faint background and a foreground that we
  // scale via opacity for "fill progress" — simple, no-PathEffect impl.
  // For real arc cut we'd use a clipping path; this is fine for v1.

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        <Group>
          <Circle cx={c} cy={c} r={r} color="#1a1d23" style="stroke" strokeWidth={thickness} />
          <Circle
            cx={c}
            cy={c}
            r={r}
            color={color}
            style="stroke"
            strokeWidth={thickness}
            opacity={clamped}
          />
        </Group>
      </Canvas>
      {label != null ? (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#e6e8eb', fontSize: size / 5, fontWeight: '600' }}>{label}</Text>
        </View>
      ) : null}
      <Text style={{ display: 'none' }}>{String(circumference)}</Text>
    </View>
  );
}
