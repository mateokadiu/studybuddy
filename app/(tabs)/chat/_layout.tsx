import { Stack } from 'expo-router';

export default function ChatStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f1115' },
        headerTintColor: '#e6e8eb',
        contentStyle: { backgroundColor: '#0f1115' },
      }}
    />
  );
}
