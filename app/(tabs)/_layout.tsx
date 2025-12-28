import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0f1115', borderTopColor: '#1f2329' },
        tabBarActiveTintColor: '#7aa2ff',
        tabBarInactiveTintColor: '#6b7280',
        headerStyle: { backgroundColor: '#0f1115' },
        headerTintColor: '#e6e8eb',
      }}
    >
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="decks" options={{ title: 'Decks' }} />
      <Tabs.Screen name="review" options={{ title: 'Review' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
    </Tabs>
  );
}
