/// <reference types="node" />

// ambient declarations for native modules we cannot npm-install in this
// non-native-build environment. typecheck-only stubs; real types come
// from the actual packages once `expo prebuild` + `pod install` run.

declare module 'react-native' {
  import type { ComponentType, ReactNode } from 'react';

  export interface ViewStyle {
    [key: string]: unknown;
    inset?: number;
  }
  export interface TextStyle extends ViewStyle {}
  export interface ImageStyle extends ViewStyle {}

  export type StyleProp<T> = T | (T | null | undefined | false)[] | null | undefined | false;

  export interface ViewProps {
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
    onLayout?: (e: unknown) => void;
    pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
    testID?: string;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessible?: boolean;
    onPress?: () => void;
  }
  export interface TextProps {
    style?: StyleProp<TextStyle>;
    children?: ReactNode;
    numberOfLines?: number;
    testID?: string;
    onPress?: () => void;
  }
  export interface PressableProps extends ViewProps {
    onPress?: () => void;
    onLongPress?: () => void;
    disabled?: boolean;
    hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  }
  export interface TextInputProps extends ViewProps {
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    placeholderTextColor?: string;
    multiline?: boolean;
    autoFocus?: boolean;
    onSubmitEditing?: () => void;
    keyboardType?: string;
    returnKeyType?: string;
  }
  export interface ScrollViewProps extends ViewProps {
    horizontal?: boolean;
    contentContainerStyle?: StyleProp<ViewStyle>;
    showsHorizontalScrollIndicator?: boolean;
    showsVerticalScrollIndicator?: boolean;
    onScroll?: (e: unknown) => void;
    refreshControl?: ReactNode;
    keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  }
  export interface FlatListProps<T> extends ViewProps {
    data: ReadonlyArray<T> | null | undefined;
    renderItem: (info: { item: T; index: number }) => ReactNode;
    keyExtractor?: (item: T, index: number) => string;
    ListEmptyComponent?: ComponentType | ReactNode;
    ListHeaderComponent?: ComponentType | ReactNode;
    ListFooterComponent?: ComponentType | ReactNode;
    onEndReached?: () => void;
    onEndReachedThreshold?: number;
    refreshing?: boolean;
    onRefresh?: () => void;
    contentContainerStyle?: StyleProp<ViewStyle>;
    horizontal?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    showsVerticalScrollIndicator?: boolean;
    extraData?: unknown;
    ItemSeparatorComponent?: ComponentType;
    ref?: unknown;
  }

  export const View: ComponentType<ViewProps>;
  export const Text: ComponentType<TextProps>;
  export const Pressable: ComponentType<PressableProps>;
  export const TextInput: ComponentType<TextInputProps>;
  export const ScrollView: ComponentType<ScrollViewProps>;
  export const FlatList: <T>(props: FlatListProps<T>) => JSX.Element;
  export const SafeAreaView: ComponentType<ViewProps>;
  export const Image: ComponentType<ViewProps & { source: unknown; resizeMode?: string }>;
  export const ActivityIndicator: ComponentType<ViewProps & { size?: 'small' | 'large' | number; color?: string }>;
  export const Switch: ComponentType<ViewProps & { value?: boolean; onValueChange?: (v: boolean) => void }>;
  export const Modal: ComponentType<ViewProps & { visible?: boolean; onRequestClose?: () => void; transparent?: boolean }>;
  export const KeyboardAvoidingView: ComponentType<ViewProps & { behavior?: 'height' | 'padding' | 'position' }>;
  export const Platform: { OS: 'ios' | 'android' | 'web'; select<T>(spec: { ios?: T; android?: T; web?: T; default?: T }): T };
  export const Dimensions: { get(dim: 'window' | 'screen'): { width: number; height: number } };
  export const Alert: { alert(title: string, message?: string, buttons?: ReadonlyArray<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>): void };
  export const Linking: { openURL(url: string): Promise<void> };

  export const StyleSheet: {
    create<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(styles: T): T;
    flatten<T>(style: StyleProp<T>): T;
    hairlineWidth: number;
    absoluteFillObject: ViewStyle;
  };
}

declare module 'react-native-mmkv';
declare module 'react-native-quick-sqlite';
declare module 'react-native-pdf-extract';
declare module 'react-native-gesture-handler' {
  import type { ComponentType, ReactNode } from 'react';
  import type { ViewProps } from 'react-native';
  export const GestureHandlerRootView: ComponentType<ViewProps>;
  export const GestureDetector: ComponentType<{ gesture: unknown; children?: ReactNode }>;
  export const Gesture: {
    Pan(): {
      enabled(v: boolean): ReturnType<typeof Gesture.Pan>;
      onUpdate(fn: (e: { translationX: number; translationY: number }) => void): ReturnType<typeof Gesture.Pan>;
      onEnd(fn: (e: { translationX: number; translationY: number }) => void): ReturnType<typeof Gesture.Pan>;
    };
    Tap(): {
      onEnd(fn: () => void): ReturnType<typeof Gesture.Tap>;
    };
    Simultaneous<T extends unknown[]>(...gestures: T): T[0];
  };
}
declare module 'react-native-reanimated' {
  import type { ComponentType, ReactNode } from 'react';
  import type { ViewProps } from 'react-native';
  export interface SharedValue<T> {
    value: T;
  }
  export function useSharedValue<T>(initial: T): SharedValue<T>;
  export function useDerivedValue<T>(fn: () => T, deps?: unknown[]): SharedValue<T>;
  export function useAnimatedStyle<T extends object>(fn: () => T, deps?: unknown[]): T;
  export function withTiming<T>(toValue: T, config?: { duration?: number; easing?: unknown }, callback?: (finished: boolean) => void): T;
  export function withSpring<T>(toValue: T, config?: unknown): T;
  export function withDelay<T>(delay: number, animation: T): T;
  export function withSequence<T>(...animations: T[]): T;
  export function interpolate(value: number, input: ReadonlyArray<number>, output: ReadonlyArray<number>, extrapolate?: unknown): number;
  export function runOnJS<T extends (...a: never[]) => unknown>(fn: T): T;
  export function runOnUI<T extends (...a: never[]) => unknown>(fn: T): T;
  export const Easing: {
    bezier(x1: number, y1: number, x2: number, y2: number): unknown;
    linear: unknown;
    in(easing?: unknown): unknown;
    out(easing?: unknown): unknown;
    inOut(easing?: unknown): unknown;
  };
  const View: ComponentType<ViewProps & { children?: ReactNode }>;
  const ScrollView: ComponentType<ViewProps & { children?: ReactNode }>;
  const Text: ComponentType<ViewProps & { children?: ReactNode }>;
  const Image: ComponentType<ViewProps>;
  const Animated: {
    View: typeof View;
    ScrollView: typeof ScrollView;
    Text: typeof Text;
    Image: typeof Image;
    createAnimatedComponent<T>(c: T): T;
  };
  export default Animated;
}
declare module '@shopify/react-native-skia' {
  import type { ComponentType, ReactNode } from 'react';
  import type { ViewStyle, StyleProp } from 'react-native';
  export const Canvas: ComponentType<{
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
    onTouch?: (e: unknown) => void;
  }>;
  export const Group: ComponentType<{ children?: ReactNode; transform?: unknown; opacity?: number }>;
  export const Rect: ComponentType<{
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    opacity?: number;
  }>;
  export const Circle: ComponentType<{ cx: number; cy: number; r: number; color?: string; opacity?: number; style?: 'fill' | 'stroke'; strokeWidth?: number }>;
  export const Path: ComponentType<{
    path: unknown;
    color?: string;
    style?: 'fill' | 'stroke';
    strokeWidth?: number;
    opacity?: number;
  }>;
  export const Text: ComponentType<{ x: number; y: number; text: string; font?: unknown; color?: string }>;
  export const Line: ComponentType<{ p1: { x: number; y: number }; p2: { x: number; y: number }; color?: string; strokeWidth?: number }>;
  export const Skia: {
    Path: {
      Make(): {
        moveTo(x: number, y: number): unknown;
        lineTo(x: number, y: number): unknown;
        cubicTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): unknown;
        close(): unknown;
        toSVGString(): string;
      };
    };
  };
}
declare module 'expo-router' {
  import type { ComponentType, ReactNode } from 'react';
  type NavProps = { screenOptions?: unknown; children?: ReactNode };
  export const Stack: ComponentType<NavProps> & {
    Screen: ComponentType<{ name?: string; options?: unknown }>;
  };
  export const Tabs: ComponentType<NavProps> & {
    Screen: ComponentType<{ name?: string; options?: unknown }>;
  };
  export function Link(props: { href: string; asChild?: boolean; children?: ReactNode; style?: unknown }): JSX.Element;
  export function Redirect(props: { href: string }): null;
  export function useRouter(): {
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
  };
  export function useLocalSearchParams<T = Record<string, string>>(): T;
  export function useGlobalSearchParams<T = Record<string, string>>(): T;
}
declare module 'expo-document-picker';
declare module 'expo-file-system';
declare module 'expo-notifications';
declare module 'expo-status-bar';
declare module 'expo-constants';
declare module 'expo-linking';
declare module 'gpt-3-encoder';
declare module 'react-native-executorch';
