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
        <ListRow title={kind.toUpperCase()} subtitle="Capture type" />
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Short title" />
        <Input label="Body" value={body} onChangeText={setBody} placeholder="Text or payload" multiline />
        {settings.dataVisibility === 'detailed' ? <Input label="External ID" value={externalId} onChangeText={setExternalId} placeholder="optional" /> : null}
        <Input label="Tags" value={tags} onChangeText={setTags} placeholder="comma separated" />
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
  return <EmptyState title="Captured" description={message ?? 'Saved to your personal knowledge base.'} primaryActionLabel="Capture another" onPrimaryAction={onCaptureAnother} />;
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
        <Input label="Friendly name" value={alias} onChangeText={setAlias} placeholder="Merchant or topic name" />
        <Input label="Category" value={categoryPath} onChangeText={setCategoryPath} placeholder="Food / Groceries" />
        <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Why this decision is useful" multiline />
        {suggestions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.map((suggestion) => (
              <FilterChip key={suggestion} label={suggestion} selected={alias === suggestion} onPress={() => setAlias(suggestion)} />
            ))}
          </View>
        ) : null}
        <ActionRow
          primaryLabel="Accept"
          primaryOnPress={() => onResolve({ alias, categoryPath: categoryPath.split('/').map((part) => part.trim()).filter(Boolean), notes: notes.trim() || undefined })}
          secondaryLabel="Ignore"
          secondaryOnPress={onIgnore}
        />
      </View>
    </Surface>
  );
}

export const AliasDecisionForm = ResolutionForm;

