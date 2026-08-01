import { Feather } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { Text, View } from 'react-native';

import { EmptyState } from '@/components/states';
import { Button, Input, ListRow, Surface } from '@/components/primitives';
import { SummaryGrid } from '@/components/cards';
import { ResolutionForm, AliasDecisionForm } from '@/components/forms';
import { useTheme } from '@/lib/app-state';
import { SummaryMetric } from '@/lib/domain';

export { AliasDecisionForm, ResolutionForm };

export function ReviewSummary({ metrics }: { metrics: SummaryMetric[] }) {
  return <SummaryGrid metrics={metrics} />;
}

export const ReviewQueueItem = ListRow;
export const ActionPreview = EmptyState;

export function MergePreview() {
  return <EmptyState title="Merge preview" description="Suggested item merges will appear here when BrainIA finds likely duplicates." />;
}

export function CategoryPicker({
  categories,
  selectedCategory,
  onSelect,
  onCreate,
}: {
  categories: string[];
  selectedCategory: string;
  onSelect: (category: string) => void;
  onCreate?: (category: string) => void;
}) {
  const theme = useTheme();
  const [newCategory, setNewCategory] = useState('');
  const paths = Array.from(new Set(categories.map((path) => path.trim()).filter(Boolean)));

  function create() {
    const value = newCategory.split('/').map((part) => part.trim()).filter(Boolean).join(' / ');
    if (!value || !onCreate) return;
    onCreate(value);
    setNewCategory('');
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Pick an existing category first. Create one only when it does not fit.</Text>
      <View style={{ gap: 10 }}>
        {paths.map((path) => (
          <ListRow
            key={path}
            title={path}
            subtitle="Category"
            leading={<Feather name={categoryIconFor(path)} size={18} color={theme.colors.accentStrong} />}
            trailing={<Text style={[theme.typography.caption, { color: selectedCategory === path ? theme.colors.success : theme.colors.textMuted }]}>{selectedCategory === path ? 'Selected' : 'Use'}</Text>}
            onPress={() => onSelect(path)}
          />
        ))}
      </View>
      {onCreate ? <Surface variant="subtle" style={{ gap: theme.spacing.md }}>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Create new category</Text>
        <Input label="New category path" value={newCategory} onChangeText={setNewCategory} placeholder="Food / Delivery" />
        <Button label="Create category" onPress={create} variant="secondary" disabled={!newCategory.trim()} />
      </Surface> : null}
    </View>
  );
}

function categoryIconFor(path: string): NonNullable<ComponentProps<typeof Feather>['name']> {
  const normalized = path.toLowerCase();
  if (normalized.includes('food') || normalized.includes('delivery') || normalized.includes('grocer')) return 'shopping-bag';
  if (normalized.includes('subscription')) return 'repeat';
  if (normalized.includes('bill') || normalized.includes('utilit')) return 'credit-card';
  if (normalized.includes('transport')) return 'truck';
  if (normalized.includes('entertainment')) return 'film';
  if (normalized.includes('going out')) return 'users';
  if (normalized.includes('health')) return 'heart';
  if (normalized.includes('home')) return 'home';
  return 'tag';
}
