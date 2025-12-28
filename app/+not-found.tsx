import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'not found' }} />
      <View style={styles.container}>
        <Text style={styles.text}>this screen doesn't exist.</Text>
        <Link href="/(tabs)/library" style={styles.link}>
          <Text style={styles.linkText}>go home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  text: { color: '#e6e8eb', fontSize: 16 },
  link: { marginTop: 15, paddingVertical: 15 },
  linkText: { color: '#7aa2ff', fontSize: 14 },
});
