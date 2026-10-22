import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, ChipGroup, Field, SegmentedControl, Tag } from '@/components/controls';
import { IconTile, Row } from '@/components/data/Row';
import { StateView } from '@/components/data/StateView';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { Screen, Section } from '@/components/layout/Screen';
import { useToast } from '@/components/layout/Toast';
import { useAppState, useBrainIAClient, useTheme } from '@/lib/app-state';
import { DEFAULT_FINANCIAL_CATEGORIES, FinancialAccount } from '@/lib/domain';
import { translateKnownLabel } from '@/lib/format';
import { Rule, RuleCurrencyMatch, RuleDraft, describeAction, describeConditions, useRules, validateDraft } from '@/lib/rules';

type ActionKind = 'currency' | 'category' | 'account';

type Editor = {
  id?: string;
  source: string;
  text: string;
  currency: RuleCurrencyMatch;
  reference: string;
  kind: ActionKind;
  currencyValue: 'UYU' | 'USD';
  category: string;
  accountId: string;
};

const blankEditor: Editor = { source: '', text: '', currency: 'any', reference: '', kind: 'category', currencyValue: 'UYU', category: '', accountId: '' };

const currencyItems = [
  { value: 'any', label: 'Todas' },
  { value: 'unknown', label: 'Incierta' },
  { value: 'UYU', label: 'UYU' },
  { value: 'USD', label: 'USD' },
] as const;

const kindItems = [
  { value: 'currency', label: 'Moneda' },
  { value: 'category', label: 'Categoría' },
  { value: 'account', label: 'Cuenta' },
] as const;

const examples: { title: string; draft: RuleDraft | Editor; ready: boolean }[] = [
  { title: 'PedidosYa con moneda incierta → UYU', ready: true, draft: { source: 'PedidosYa', text: '', currency: 'unknown', reference: '', action: { field: 'currency', value: 'UYU' } } },
  { title: 'PedidosYa → categoría Delivery', ready: true, draft: { source: 'PedidosYa', text: '', currency: 'any', reference: '', action: { field: 'category', value: 'Food / Delivery' } } },
  { title: 'PedidosYa Market → categoría Supermercado', ready: true, draft: { source: 'PedidosYa', text: 'PedidosYa Market', currency: 'any', reference: '', action: { field: 'category', value: 'Food / Groceries' } } },
  { title: 'Prex en UYU → una de tus cuentas', ready: false, draft: { ...blankEditor, source: 'Prex', currency: 'UYU', kind: 'account' } },
  { title: 'Un número de cuenta o tarjeta → una de tus cuentas', ready: false, draft: { ...blankEditor, kind: 'account' } },
];

const actionIcon = { currency: 'dollar-sign', category: 'tag', account: 'credit-card' } as const;

function toEditor(rule: Rule): Editor {
  return {
    id: rule.id,
    source: rule.source,
    text: rule.text,
    currency: rule.currency,
    reference: rule.reference,
    kind: rule.action.field,
    currencyValue: rule.action.field === 'currency' ? rule.action.value : 'UYU',
    category: rule.action.field === 'category' ? rule.action.value : '',
    accountId: rule.action.field === 'account' ? rule.action.accountId : '',
  };
}

export default function RulesScreen() {
  const theme = useTheme();
  const toast = useToast();
  const client = useBrainIAClient();
  const { invalidateFinancialData } = useAppState();
  const { rules, ready, add, update, setEnabled, remove } = useRules();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<string[]>([...DEFAULT_FINANCIAL_CATEGORIES.expense, ...DEFAULT_FINANCIAL_CATEGORIES.income]);

  const open = useCallback((next: Editor) => {
    setError(null);
    setEditor(next);
    void Promise.allSettled([client.listFinancialAccounts(), client.listFinancialCategories()]).then(([accountResult, categoryResult]) => {
      if (accountResult.status === 'fulfilled') {
        setAccounts(accountResult.value);
        // A starting point such as "Prex" suggests the account whose name says so.
        setEditor((current) => {
          if (!current || current.accountId || current.kind !== 'account' || !current.source.trim()) return current;
          const hint = current.source.trim().toLowerCase();
          const guess = accountResult.value.find((account) => account.name.toLowerCase().includes(hint) && (current.currency === 'UYU' || current.currency === 'USD' ? account.currency === current.currency : true));
          return guess ? { ...current, accountId: guess.id } : current;
        });
      }
      if (categoryResult.status === 'fulfilled') setCategories(Array.from(new Set([...categoryResult.value.expense, ...categoryResult.value.income])));
    });
  }, [client]);

  const changed = useCallback((message: string) => {
    invalidateFinancialData();
    toast.show(message, { tone: 'positive' });
  }, [invalidateFinancialData, toast]);

  const save = async () => {
    if (!editor) return;
    const account = accounts.find((item) => item.id === editor.accountId);
    const draft: RuleDraft = {
      source: editor.source.trim(),
      text: editor.text.trim(),
      currency: editor.currency,
      reference: editor.reference.trim(),
      action: editor.kind === 'currency'
        ? { field: 'currency', value: editor.currencyValue }
        : editor.kind === 'category'
          ? { field: 'category', value: editor.category }
          : { field: 'account', accountId: editor.accountId, accountName: account?.name ?? '' },
    };
    const problem = validateDraft(draft);
    if (problem) { setError(problem); return; }
    if (editor.id) await update(editor.id, draft); else await add(draft);
    setEditor(null);
    changed(editor.id ? 'Regla actualizada' : 'Regla creada');
  };

  const addExample = async (example: (typeof examples)[number]) => {
    if (example.ready) {
      await add(example.draft as RuleDraft);
      changed('Regla añadida');
    } else {
      open({ ...(example.draft as Editor) });
    }
  };

  const active = rules.filter((rule) => rule.enabled).length;
  const unusedExamples = examples.filter((example) => !example.ready || !rules.some((rule) => {
    const draft = example.draft as RuleDraft;
    return rule.source === draft.source && rule.text === draft.text && rule.currency === draft.currency && JSON.stringify(rule.action) === JSON.stringify(draft.action);
  }));
  const set = (patch: Partial<Editor>) => setEditor((current) => (current ? { ...current, ...patch } : current));

  return (
    <Screen
      back backLabel="Volver"
      title="Reglas"
      overline="Automatización"
      subtitle="Dile a Brain IA qué asumir cuando a un movimiento le falta un dato."
      actions={ready ? <Tag label={rules.length ? `${active} ${active === 1 ? 'activa' : 'activas'}` : 'Sin reglas'} tone={active ? 'positive' : 'neutral'} /> : null}
    >
      <Section title="Tus reglas" subtitle="La más específica gana cuando varias aplican." actionLabel="Nueva regla" onActionPress={() => open({ ...blankEditor })}>
        {ready && !rules.length ? (
          <StateView icon="sliders" title="Todavía no tienes reglas" description="Crea una regla o parte de uno de los ejemplos de abajo." actionLabel="Crear una regla" onAction={() => open({ ...blankEditor })} />
        ) : (
          <GlassSurface level="thin" padding="sm" contentStyle={{ gap: theme.spacing.xs }}>
            {rules.map((rule) => (
              <Row
                key={rule.id}
                style={{ borderRadius: 0 }}
                title={describeConditions(rule)}
                titleLines={3}
                subtitle={describeAction(rule.action)}
                leading={<IconTile icon={actionIcon[rule.action.field]} color={rule.enabled ? theme.colors.accent : theme.colors.textMuted} />}
                accessory="switch"
                switchValue={rule.enabled}
                onSwitchChange={(value) => { void setEnabled(rule.id, value).then(() => invalidateFinancialData()); }}
                onPress={() => open(toEditor(rule))}
              />
            ))}
          </GlassSurface>
        )}
      </Section>

      {unusedExamples.length ? (
        <Section title="Ejemplos" subtitle="Toca uno para añadirlo o para usarlo como punto de partida.">
          <GlassSurface level="thin" padding="sm" contentStyle={{ gap: theme.spacing.xs }}>
            {unusedExamples.map((example) => (
              <Row
                key={example.title}
                style={{ borderRadius: 0 }}
                title={example.title}
                titleLines={3}
                leading={<IconTile icon="plus" color={theme.colors.model} />}
                trailing={<Text style={[theme.typography.bodyStrong, { color: theme.colors.accentStrong }]}>{example.ready ? 'Añadir' : 'Elegir'}</Text>}
                accessory="none"
                onPress={() => { void addExample(example); }}
              />
            ))}
          </GlassSurface>
        </Section>
      ) : null}

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        Las reglas solo rellenan lo que falta: nunca cambian un dato que Brain IA ya conoce. Lo asumido se marca en el movimiento. Se guardan en este teléfono.
      </Text>

      <BottomSheet
        visible={editor !== null}
        title={editor?.id ? 'Editar regla' : 'Nueva regla'}
        onClose={() => setEditor(null)}
        footer={
          <View style={{ gap: theme.spacing.sm }}>
            <Button label="Guardar regla" onPress={() => { void save(); }} full />
            {editor?.id ? <Button label="Eliminar regla" variant="danger" onPress={() => { const id = editor.id!; setEditor(null); void remove(id).then(() => changed('Regla eliminada')); }} full /> : null}
          </View>
        }
      >
        {editor ? (
          <View style={{ gap: theme.spacing.md }}>
            <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>SI EL MOVIMIENTO…</Text>
            <Field label="Viene de" hint="Una app, un banco o un comercio. Ej.: PedidosYa, Prex." value={editor.source} onChangeText={(source) => set({ source })} autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
            <Field label="Menciona" hint="Texto que aparece en el movimiento. Ej.: PedidosYa Market." value={editor.text} onChangeText={(text) => set({ text })} autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
            <View style={{ gap: theme.spacing.xs }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Moneda</Text>
              <SegmentedControl role="radio" accessibilityLabel="Moneda del movimiento" items={currencyItems} value={editor.currency} onChange={(currency) => set({ currency })} />
            </View>
            <Field label="Cuenta o tarjeta" hint="Un número o sus últimos dígitos, tal como aparece en el movimiento." value={editor.reference} onChangeText={(reference) => set({ reference })} keyboardType="number-pad" autoCorrect={false} returnKeyType="done" />

            <Text style={[theme.typography.overline, { color: theme.colors.textMuted, marginTop: theme.spacing.xs }]}>ENTONCES ASUMIR…</Text>
            <SegmentedControl role="radio" accessibilityLabel="Qué asumir" items={kindItems} value={editor.kind} onChange={(kind) => set({ kind })} />
            {editor.kind === 'currency' ? (
              <SegmentedControl role="radio" accessibilityLabel="Moneda a asumir" items={[{ value: 'UYU', label: 'Pesos (UYU)' }, { value: 'USD', label: 'Dólares (USD)' }]} value={editor.currencyValue} onChange={(currencyValue) => set({ currencyValue })} />
            ) : null}
            {editor.kind === 'category' ? (
              <ChipGroup
                items={categories.map((category) => ({ value: category, label: translateKnownLabel(category) }))}
                selected={editor.category}
                onChange={(value) => set({ category: String(value) })}
                searchable
                searchPlaceholder="Buscar categoría"
                creatable
                onCreate={(value) => set({ category: value })}
                emptyLabel="Sin coincidencias"
              />
            ) : null}
            {editor.kind === 'account' ? (
              accounts.length ? (
                <ChipGroup
                  items={accounts.map((account) => ({ value: account.id, label: account.mask ? `${account.name} ·· ${account.mask}` : account.name }))}
                  selected={editor.accountId}
                  onChange={(value) => set({ accountId: String(value) })}
                  emptyLabel="Sin cuentas"
                />
              ) : (
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Cargando tus cuentas…</Text>
              )
            ) : null}
            {error ? <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: theme.colors.danger }]}>{error}</Text> : null}
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
