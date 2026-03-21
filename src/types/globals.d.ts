/// <reference types="node" />

// ambient declarations for native modules we cannot npm-install in this
// non-native-build environment. typecheck-only stubs; real types come
// from the actual packages once `expo prebuild` + `pod install` run.

declare module 'react-native' {
  import type { ComponentType, ReactNode } from 'react';

  export interface ViewStyle {
    [key: string]: unknown;
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
    ItemSeparatorComponent?: ComponentType;
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
declare module 'react-native-gesture-handler';
declare module 'react-native-reanimated';
declare module '@shopify/react-native-skia';
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
