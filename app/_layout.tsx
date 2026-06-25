// Polyfill `crypto.getRandomValues` — must be imported before `uuid`. RN's
// Hermes runtime doesn't ship a web-crypto, and `uuid` v9+ insists on it.
import 'react-native-get-random-values';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { migrate } from '@/db/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    migrate()
      .then(() => setReady(true))
      .catch((e) => setErr(String(e instanceof Error ? e.message : e)));
  }, []);

  if (err) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f1115', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fca5a5', fontFamily: 'Menlo', fontSize: 13 }}>
          db migration failed: {err}
        </Text>
      </View>
    );
  }
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: '#0f1115' }} />;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            headerStyle: { backgroundColor: '#0f1115' },
            headerTintColor: '#e6e8eb',
            contentStyle: { backgroundColor: '#0f1115' },
          }}
        />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
