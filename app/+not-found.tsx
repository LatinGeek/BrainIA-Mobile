import { router, Stack } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { StateView } from '@/components/data/StateView';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'No encontrada' }} />
      <Screen title="Pantalla no encontrada" back backLabel="Volver" stagger={false}>
        <StateView icon="compass" title="Esta pantalla no existe" description="El enlace puede estar desactualizado." actionLabel="Volver al inicio" onAction={() => router.replace('/')} />
      </Screen>
    </>
  );
}
