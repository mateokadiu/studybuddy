import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f1115' },
        headerTintColor: '#e6e8eb',
      }}
    />
  );
}
