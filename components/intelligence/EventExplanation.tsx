import { router } from 'expo-router';
import { useMemo } from 'react';
import { Text } from 'react-native';

import { Button, Tag } from '@/components/controls';
import { Row } from '@/components/data/Row';
import { StateView } from '@/components/data/StateView';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Section } from '@/components/layout/Screen';
import { useTheme } from '@/lib/app-state';
import { formatDate } from '@/lib/format';
import { useAsyncResource } from '@/lib/hooks';
import { useIntelligenceClient } from '@/lib/intelligence';
import type { EventSummary } from '@/lib/domain';

type Explanation = {
  eventId: string;
  contentAvailable: boolean;
  evidence: { title: string | null; body: string | null } | null;
  source: string;
  occurredAt: string | null;
  ingestedAt: string | null;
  classification: { version: string | null; model: string | null; provider: string | null; modelApplied: boolean | null; reason: string | null; hasAppliedCorrections: boolean };
  fields: { type: string; value: string; origin?: 'human' | 'inferred' | 'unknown' }[];
  corrections: { field: string; value: string; createdAt: string; reused: boolean }[];
  links: { id: string; kind: 'entity' | 'transaction'; label: string }[];
};

const fieldLabels: Record<string, string> = { inferredKind: 'Tipo de actividad', merchant: 'Comercio', financialCategory: 'Categoría financiera', eventCategory: 'Categoría del evento', humanExplanation: 'Explicación humana', category: 'Categoría', entity: 'Entidad', amount: 'Importe', currency: 'Moneda', sender: 'Remitente', recipient: 'Destinatario', app: 'Aplicación', message: 'Mensaje', card_last_four: 'Últimos dígitos de tarjeta' };
const values: Record<string, string> = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia', notification: 'Notificación', note: 'Nota', email: 'Correo', task: 'Tarea', other: 'Otro' };
const dateLabel = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? formatDate(value) : 'No registrada';

export function EventExplanation({ eventId, fallbackEvent }: { eventId: string; fallbackEvent?: EventSummary }) {
  const api = useIntelligenceClient();
  const theme = useTheme();
  const loader = useMemo(() => () => api.request<Explanation>(`/events/${encodeURIComponent(eventId)}/explanation`), [api, eventId]);
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);
  const caption = [theme.typography.caption, { color: theme.colors.textSecondary }];
  if (!data) return <>
    <Section title="Evidencia y explicación">{error ? <StateView kind="error" title="Explicación no disponible" description="No pudimos consultar la explicación ni las correcciones. Puedes reintentar; la evidencia disponible se conserva abajo." actionLabel="Reintentar" onAction={refresh} /> : <Text style={caption}>{loading ? 'Consultando evidencia…' : 'No hay explicación disponible.'}</Text>}</Section>
    {error && fallbackEvent ? <Section title="Contenido original" subtitle="Evidencia disponible en el detalle de la actividad." collapsible defaultOpen={false}>
      <GlassSurface level="thin" padding="md" contentStyle={{ gap: theme.spacing.sm }}>
        <Tag label="Capturado" tone="neutral" kind="provenance" icon="inbox" />
        <Text style={caption}>Fuente: {fallbackEvent.source}</Text>
        {fallbackEvent.privacyStatus !== 'standard' ? <Text style={caption}>El contenido no está disponible con la información de privacidad actual.</Text> : <>
          {fallbackEvent.rawTitle ? <Text selectable style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{fallbackEvent.rawTitle}</Text> : null}
          <Text selectable style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{fallbackEvent.body ?? 'Esta actividad no tiene contenido original disponible.'}</Text>
        </>}
      </GlassSurface>
    </Section> : null}
  </>;

  return <>
    <Section title="Fechas de la actividad">
      <GlassSurface level="thin" padding="none">
        <Row title={dateLabel(data.occurredAt)} subtitle="Ocurrió" accessory="none" />
        <Row title={dateLabel(data.ingestedAt)} subtitle="Ingresó a Brain IA" accessory="none" />
      </GlassSurface>
    </Section>
    <Section title="Cómo se clasificó" collapsible defaultOpen={false}>
      <GlassSurface level="thin" padding="md" contentStyle={{ gap: theme.spacing.sm }}>
        <Text style={caption}>{data.classification.reason ?? 'No se guardó un motivo de clasificación que pueda mostrarse. La versión y los campos disponibles se muestran abajo.'}</Text>
        {data.classification.version ? <Text selectable style={caption}>Versión: {data.classification.version}</Text> : <Text style={caption}>Sin versión registrada: la clasificación puede estar pendiente o ser histórica.</Text>}
        {data.classification.provider ? <Text style={caption}>Proveedor: {data.classification.provider}</Text> : null}
        {data.classification.model ? <Text selectable style={caption}>Modelo: {data.classification.model}</Text> : null}
        {data.classification.modelApplied !== null ? <Text style={caption}>{data.classification.modelApplied ? 'Se aplicó la sugerencia del modelo.' : 'No se aplicó la sugerencia del modelo.'}</Text> : null}
      </GlassSurface>
    </Section>
    <Section title="Campos y correcciones" collapsible defaultOpen={false}>
      <GlassSurface level="thin" padding="md" contentStyle={{ gap: theme.spacing.sm }}>
        <Tag label="Extraído o normalizado" tone="neutral" kind="provenance" />
        <Text style={caption}>Son los campos vigentes de la clasificación, con la procedencia disponible. Las correcciones humanas se identifican por separado; los valores anteriores no se muestran en esta vista.</Text>
        {data.fields.length ? data.fields.map((field, index) => <Text selectable key={`${field.type}:${index}`} style={caption}>{fieldLabels[field.type] ?? field.type}: {field.value} · {field.origin === 'human' ? 'Corrección humana' : field.origin === 'inferred' ? 'Inferido' : 'Origen por campo no registrado'}</Text>) : <Text style={caption}>No hay campos extraídos disponibles.</Text>}
        {data.corrections.length ? <Tag label="Correcciones humanas" tone="neutral" kind="provenance" /> : null}
        {data.corrections.map((correction, index) => <Text selectable key={`${correction.field}:${index}`} style={caption}>{fieldLabels[correction.field] ?? correction.field}: {correction.field === 'inferredKind' ? values[correction.value] ?? correction.value : correction.value}{'\n'}{correction.reused ? 'Reutilizada de una corrección humana' : 'Corregido por ti'} · {dateLabel(correction.createdAt)}</Text>)}
        {!data.corrections.length ? <Text style={caption}>{data.classification.hasAppliedCorrections ? 'La clasificación registra correcciones aplicadas, pero su detalle no está disponible.' : 'No hay correcciones humanas registradas disponibles.'}</Text> : null}
      </GlassSurface>
    </Section>
    <Section title="Contenido original" subtitle="Evidencia capturada de la fuente." collapsible defaultOpen={false}>
      <GlassSurface level="thin" padding="md" contentStyle={{ gap: theme.spacing.sm }}>
        <Tag label="Capturado" tone="neutral" kind="provenance" icon="inbox" />
        <Text style={caption}>Fuente: {data.source}</Text>
        {!data.contentAvailable ? <Text style={caption}>El contenido está protegido por la configuración de privacidad.</Text> : <>
          {data.evidence?.title ? <Text selectable style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{data.evidence.title}</Text> : null}
          <Text selectable style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{data.evidence?.body ?? 'Esta actividad no tiene contenido original disponible.'}</Text>
        </>}
      </GlassSurface>
    </Section>
    <Section title="Registros vinculados">
      {data.links.length ? data.links.map(link => <Button key={`${link.kind}:${link.id}`} label={link.label} variant="secondary" onPress={() => router.push({ pathname: link.kind === 'transaction' ? '/transaction/[id]' : '/entity/[id]', params: { id: link.id } })} />) : <Text style={caption}>No hay registros vinculados disponibles.</Text>}
    </Section>
  </>;
}
