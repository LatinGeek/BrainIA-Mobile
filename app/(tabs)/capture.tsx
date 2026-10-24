import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';

import { CaptureForm, type CaptureFormHandle, type CaptureFormStatus } from '@/components/capture/CaptureForm';
import { Button, Tag } from '@/components/controls';
import { Screen } from '@/components/layout/Screen';

export default function CaptureScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const form = useRef<CaptureFormHandle>(null);
  const [status, setStatus] = useState<CaptureFormStatus>({ busy: false, label: 'Capturar' });
  const initialMode = mode === 'expense' || mode === 'income' || mode === 'transfer' || mode === 'note' || mode === 'wallet' ? (mode === 'note' || mode === 'wallet' ? mode : 'wallet') : 'note';

  return (
    <Screen
      title="Capturar"
      overline="Nueva entrada"
      subtitle="Convertí una idea o movimiento en información útil."
      actions={<Tag label={status.busy ? 'Guardando' : 'Listo'} tone={status.busy ? 'warning' : 'positive'} />}
      bar={<Button label={status.label} onPress={() => form.current?.submit()} loading={status.busy} size="md" full />}
    >
      <CaptureForm
        ref={form}
        initialMode={initialMode}
        onStatusChange={setStatus}
      />
      <Tag label="Captura rápida" tone="neutral" kind="stamp" icon="zap" />
    </Screen>
  );
}
