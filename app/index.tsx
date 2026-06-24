import { useSettings } from '@/stores/settings.store';
import { Redirect } from 'expo-router';

export default function Index() {
  const onboardingDone = useSettings((s) => s.onboardingDone);
  return <Redirect href={onboardingDone ? '/(tabs)/library' : '/onboarding'} />;
}
