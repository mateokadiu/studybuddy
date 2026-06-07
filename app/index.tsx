import { Redirect } from 'expo-router';
import { useSettings } from '@/stores/settings.store';

export default function Index() {
  const onboardingDone = useSettings((s) => s.onboardingDone);
  return <Redirect href={onboardingDone ? '/(tabs)/library' : '/onboarding'} />;
}
