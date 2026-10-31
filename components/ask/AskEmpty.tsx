import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { useAsyncResource } from '@/lib/hooks';
import type { BrainIAClient } from '@/lib/api';

type Suggestion = { text: string; icon: React.ComponentProps<typeof Feather>['name'] };

const MONEY: Suggestion[] = [
  { text: '¿Cuánto gasté este mes?', icon: 'bar-chart-2' },
  { text: '¿En qué gasté más la semana pasada?', icon: 'pie-chart' },
  { text: 'Compara mis gastos de este mes con el anterior', icon: 'trending-up' },
  { text: '¿Cuáles fueron mis mayores gastos este mes?', icon: 'list' },
];

const KNOWLEDGE: Suggestion[] = [
  { text: '¿Qué pasó esta semana?', icon: 'calendar' },
  { text: '¿Qué suscripciones estoy pagando?', icon: 'repeat' },
];

function SuggestionRow({ item, onPress }: { item: Suggestion; onPress: () => void }) {
  const theme = useTheme();
  return (
    <GlassPressable accessibilityRole="button" accessibilityLabel={`Preguntar: ${item.text}`} onPress={onPress} haptic="selection" scaleTo={0.98}>
      <View style={[styles.suggestion, { borderBottomColor: theme.glass.divider }]}>
        <Feather name={item.icon} size={15} color={theme.colors.textMuted} />
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary, flex: 1 }]}>{item.text}</Text>
        <Feather name="arrow-up-right" size={14} color={theme.colors.textMuted} />
      </View>
    </GlassPressable>
  );
}

/**
 * First view of the chat. Suggestions mix fixed questions that show what the
 * assistant can do with ones built from the user's most frequent merchants.
 */
export function AskEmpty({ client, onAsk, voiceAvailable }: { client: BrainIAClient; onAsk: (text: string) => void; voiceAvailable: boolean }) {
  const theme = useTheme();
  const loader = useMemo(() => () => client.listTransactions(30), [client]);
  const { data: transactions } = useAsyncResource(loader, [loader]);
  const personal = useMemo<Suggestion[]>(() => {
    const counts = new Map<string, number>();
    for (const item of transactions ?? []) {
      if (item.kind && item.kind !== 'expense') continue;
      // Interpreted titles read "Compra en PedidosYa"; the question needs the merchant itself.
      const label = (item.displayMerchantLabel ?? item.merchantLabel ?? '')
        .replace(/^(compra|pago|pedido|cargo|suscripci[oó]n|d[eé]bito)\s+(en|a|de)\s+/i, '')
        .trim();
      if (label.length < 2 || label.length > 28) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
      .map(([label]) => ({ text: `¿Cuánto gasté en ${label} en los últimos 3 meses?`, icon: 'shopping-bag' as const }));
  }, [transactions]);

  return (
    <View style={{ gap: 18 }}>
      <GlassSurface level="regular" tone="model" padding="lg" contentStyle={{ gap: 10 }}>
        <View style={[styles.mark, { backgroundColor: `${theme.colors.model}1F`, borderColor: `${theme.colors.model}55` }]}>
          <Feather name="cpu" size={18} color={theme.colors.model} />
        </View>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary, fontSize: 20, lineHeight: 26 }]}>¿Qué quieres saber?</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Respondo con lo que BrainIA capturó: movimientos, notas, correos y personas. Los montos se calculan con tus datos y cada respuesta cita sus fuentes.
        </Text>
        {voiceAvailable ? (
          <View style={styles.hint}>
            <Feather name="mic" size={12} color={theme.colors.textMuted} />
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Toca el micrófono para preguntar con la voz.</Text>
          </View>
        ) : null}
      </GlassSurface>

      <View style={{ gap: 6 }}>
        <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Tu dinero</Text>
        <GlassSurface level="thin" padding="none" contentStyle={{ paddingHorizontal: 14 }}>
          {[...personal, ...MONEY].slice(0, 5).map((item) => <SuggestionRow key={item.text} item={item} onPress={() => onAsk(item.text)} />)}
        </GlassSurface>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Tu conocimiento</Text>
        <GlassSurface level="thin" padding="none" contentStyle={{ paddingHorizontal: 14 }}>
          {KNOWLEDGE.map((item) => <SuggestionRow key={item.text} item={item} onPress={() => onAsk(item.text)} />)}
        </GlassSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
