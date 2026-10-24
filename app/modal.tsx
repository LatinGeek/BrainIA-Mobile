import { Redirect } from 'expo-router';

// Preserve old deep links without registering a second copy of Settings.
export default function Modal() {
  return <Redirect href="/settings" />;
}
