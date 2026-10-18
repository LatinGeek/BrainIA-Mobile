import { useState } from 'react';
import { View } from 'react-native';

import { ActionButton, Button, FilterChip, Input, ListRow, Surface } from '@/components/primitives';
import { EmptyState } from '@/components/states';
import { useAppState, useTheme } from '@/lib/app-state';

export function CaptureForm({
  kind,
  onSubmit,
  submitLabel = 'Send',
}: {
  kind: 'note' | 'email' | 'notification' | 'wallet' | 'event';
  onSubmit: (payload: Record<string, unknown>) => void;
  submitLabel?: string;
}) {
  const theme = useTheme();
  const { settings } = useAppState();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [externalId, setExternalId] = useState('');
  const [tags, setTags] = useState('mobile,brainia');

  return (
    <Surface>
      <View style={{ gap: theme.spacing.md }}>
        <ListRow title={kind.toUpperCase()} subtitle="Tipo de captura" />
        <Input label="Título" value={title} onChangeText={setTitle} placeholder="Título breve" />
        <Input label="Contenido" value={body} onChangeText={setBody} placeholder="Texto original" multiline />
        {settings.dataVisibility === 'detailed' ? <Input label="Identificador externo" value={externalId} onChangeText={setExternalId} placeholder="opcional" /> : null}
        <Input label="Etiquetas" value={tags} onChangeText={setTags} placeholder="separados por comas" />
        <ActionButton
          label={submitLabel}
          onPress={() =>
            onSubmit({
              kind,
              title,
              body,
              externalId: externalId.trim() || undefined,
              tags: tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
            })
          }
        />
      </View>
    </Surface>
  );
}

export const QuickCapture = CaptureForm;
export const ExpenseCapture = CaptureForm;
export const EmailCapture = CaptureForm;
export const NotificationCapture = CaptureForm;

export function CaptureSuccess({ message, onCaptureAnother }: { message?: string; onCaptureAnother: () => void }) {
  return <EmptyState title="Capturado" description={message ?? 'Guardado en tu conocimiento personal.'} primaryActionLabel="Capturar otra" onPrimaryAction={onCaptureAnother} />;
}

export function ActionRow({
  primaryLabel,
  primaryOnPress,
  secondaryLabel,
  secondaryOnPress,
}: {
  primaryLabel: string;
  primaryOnPress: () => void;
  secondaryLabel?: string;
  secondaryOnPress?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Button label={primaryLabel} onPress={primaryOnPress} />
      {secondaryLabel && secondaryOnPress ? <Button label={secondaryLabel} onPress={secondaryOnPress} variant="secondary" /> : null}
    </View>
  );
}

export function ResolutionForm({
  defaultAlias,
  defaultCategoryPath,
  suggestions = [],
  onResolve,
  onIgnore,
}: {
  defaultAlias?: string;
  defaultCategoryPath?: string[];
  suggestions?: string[];
  onResolve: (payload: { alias: string; categoryPath: string[]; notes?: string }) => void;
  onIgnore?: () => void;
}) {
  const theme = useTheme();
  const [alias, setAlias] = useState(defaultAlias ?? '');
  const [categoryPath, setCategoryPath] = useState((defaultCategoryPath ?? []).join(' / '));
  const [notes, setNotes] = useState('');

  return (
    <Surface>
      <View style={{ gap: theme.spacing.md }}>
        <Input label="Nombre habitual" value={alias} onChangeText={setAlias} placeholder="Nombre de comercio o tema" />
        <Input label="Categoría" value={categoryPath} onChangeText={setCategoryPath} placeholder="Food / Groceries" />
        <Input label="Notas" value={notes} onChangeText={setNotes} placeholder="Por qué ayuda esta decisión" multiline />
        {suggestions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.map((suggestion) => (
              <FilterChip key={suggestion} label={suggestion} selected={alias === suggestion} onPress={() => setAlias(suggestion)} />
            ))}
          </View>
        ) : null}
        <ActionRow
          primaryLabel="Aceptar"
          primaryOnPress={() => onResolve({ alias, categoryPath: categoryPath.split('/').map((part) => part.trim()).filter(Boolean), notes: notes.trim() || undefined })}
          secondaryLabel="Ignorar"
          secondaryOnPress={onIgnore}
        />
      </View>
    </Surface>
  );
}

export const AliasDecisionForm = ResolutionForm;
