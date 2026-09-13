import { Feather } from '@expo/vector-icons';
import { useMemo, useState, type ComponentProps } from 'react';
import { Text, View } from 'react-native';

import { EmptyState } from '@/components/states';
import { Button, Input, ListRow, Surface } from '@/components/primitives';
import { SummaryGrid } from '@/components/cards';
import { ResolutionForm, AliasDecisionForm } from '@/components/forms';
import { useTheme } from '@/lib/app-state';
import { EntityTag, SummaryMetric } from '@/lib/domain';

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
  const [query, setQuery] = useState('');
  const paths = Array.from(new Set(categories.map((path) => path.trim()).filter(Boolean)));
  const visiblePaths = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? paths.filter((path) => path.toLocaleLowerCase().includes(normalized)) : paths;
  }, [paths, query]);

  function create() {
    const value = newCategory.split('/').map((part) => part.trim()).filter(Boolean).join(' / ');
    if (!value || !onCreate) return;
    onCreate(value);
    setNewCategory('');
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Elegí una categoría o creá una que describa mejor este movimiento.</Text>
      <Input label="Buscar categorías" value={query} onChangeText={setQuery} placeholder="Comida, alquiler, sueldo..." returnKeyType="search" />
      <View style={{ gap: 10 }}>
        {visiblePaths.map((path) => (
          <ListRow
            key={path}
            title={path}
            subtitle="Categoría"
            leading={<Feather name={categoryIconFor(path)} size={18} color={theme.colors.accentStrong} />}
            trailing={<Text style={[theme.typography.caption, { color: selectedCategory === path ? theme.colors.success : theme.colors.textMuted }]}>{selectedCategory === path ? 'Elegida' : 'Usar'}</Text>}
            onPress={() => onSelect(path)}
          />
        ))}
      </View>
      {visiblePaths.length === 0 && query.trim() ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>No hay coincidencias. Podés crear “{query.trim()}”.</Text> : null}
      {onCreate ? <Surface variant="subtle" style={{ gap: theme.spacing.md }}>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Nueva categoría</Text>
        <Input label="Nombre o ruta" value={newCategory} onChangeText={setNewCategory} placeholder="Comida / Viandas" onSubmitEditing={create} returnKeyType="done" />
        <Button label="Crear categoría" onPress={create} variant="secondary" disabled={!newCategory.trim()} />
      </Surface> : null}
    </View>
  );
}

export function EntityTagPicker({
  tags,
  selectedPath,
  onSelect,
}: {
  tags: EntityTag[];
  selectedPath: string[];
  onSelect: (path: string[]) => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [parentKey, setParentKey] = useState<string | null>(null);
  const byKey = useMemo(() => new Map(tags.map((tag) => [tag.key, tag])), [tags]);
  const roots = useMemo(() => tags.filter((tag) => !tag.parentKey), [tags]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const currentParent = parentKey ? byKey.get(parentKey) : undefined;
  const visible = useMemo(() => {
    if (normalizedQuery) return tags.filter((tag) => `${tag.label} ${tag.description}`.toLocaleLowerCase().includes(normalizedQuery));
    return parentKey ? tags.filter((tag) => tag.parentKey === parentKey) : roots;
  }, [normalizedQuery, parentKey, roots, tags]);

  function pathFor(tag: EntityTag) {
    const path: EntityTag[] = [];
    let current: EntityTag | undefined = tag;
    while (current) {
      path.unshift(current);
      current = current.parentKey ? byKey.get(current.parentKey) : undefined;
    }
    return path;
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Etiquetá el contexto de esta entidad en tu grafo. Esto no modifica la categoría de ninguna transacción.</Text>
      <Input label="Buscar áreas de vida" value={query} onChangeText={setQuery} placeholder="Trabajo, comida, hogar, música..." returnKeyType="search" />
      {!normalizedQuery && currentParent ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Button label={`← ${pathFor(currentParent).slice(0, -1).map((item) => item.label).join(' / ') || 'Áreas de vida'}`} variant="ghost" size="sm" onPress={() => setParentKey(currentParent.parentKey ?? null)} />
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{pathFor(currentParent).map((item) => item.label).join(' / ')}</Text>
          <Button label={`Usar “${currentParent.label}”`} variant="secondary" size="sm" onPress={() => onSelect(pathFor(currentParent).map((item) => item.label))} />
        </View>
      ) : null}
      <View style={{ gap: 10 }}>
        {visible.map((tag) => {
          const path = pathFor(tag);
          const labels = path.map((item) => item.label);
          const selected = labels.join(' / ') === selectedPath.join(' / ');
          const children = tags.filter((candidate) => candidate.parentKey === tag.key);
          return (
            <ListRow
              key={tag.key}
              title={labels.join(' / ')}
              subtitle={tag.description}
              description={!normalizedQuery && children.length ? `${children.length} subetiqueta${children.length === 1 ? '' : 's'}` : undefined}
              leading={<Feather name={tag.kind === 'domain' ? 'layers' : 'tag'} size={18} color={theme.colors.accentStrong} />}
              trailing={<Text style={[theme.typography.caption, { color: selected ? theme.colors.success : theme.colors.textMuted }]}>{selected ? 'Etiquetada' : children.length && !normalizedQuery ? 'Explorar' : 'Usar'}</Text>}
              onPress={() => children.length && !normalizedQuery ? setParentKey(tag.key) : onSelect(labels)}
            />
          );
        })}
      </View>
      {!visible.length ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>No hay una etiqueta gobernada que coincida. Usá un término más amplio para conservar consistencia en el grafo.</Text> : null}
      {selectedPath.length ? <Button label="Quitar etiquetas" variant="secondary" onPress={() => onSelect([])} /> : null}
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
