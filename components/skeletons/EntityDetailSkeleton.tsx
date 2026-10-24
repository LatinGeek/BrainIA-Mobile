import { View } from 'react-native';

import { SkeletonBlock, SkeletonGroup, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { SkeletonRow, SkeletonSection } from './parts';

export const ENTITY_TAG_HEIGHT = 24;
export const ENTITY_ALIAS_CHIP_HEIGHT = 34;
const ENTITY_ACTION_HEIGHT = 44;
/** Most elements carry no alternative names yet (both measured on a real account had none): "Otros nombres" is then just its header. */
const ENTITY_ALIAS_COUNT = 0;

/** The accent identity card: type tile, headline over summary, three tags (they wrap to two rows at 390dp) and the organise button. */
function EntityHeroCardSkeleton() {
  const { spacing } = useTheme();
  return (
    <GlassSurface level="strong" tone="accent" padding="lg" contentStyle={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <SkeletonBlock width={48} height={48} radius={16} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <SkeletonLine width="40%" lineHeight={23} />
          <SkeletonLine width="86%" lineHeight={16} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {[135, 88, 110].map((width, index) => <SkeletonBlock key={index} width={width} height={ENTITY_TAG_HEIGHT} radius={999} />)}
      </View>
      <SkeletonBlock height={ENTITY_ACTION_HEIGHT} radius={999} />
    </GlassSurface>
  );
}

/**
 * "Sin fuente capturada" card height on the 411dp moto g04s (measured on a real entity, Spotify). "Evidencia" only matches events among
 * the 50 most recent, so an entity opened from older activity usually lands on that empty card; two timeline rows are
 * about as tall, and the floor keeps the card at the empty state's height when the rows come out lighter.
 */
const ENTITY_EVIDENCE_EMPTY_HEIGHT = 178;

/** The evidence list: a thin card of timeline rows, as "Evidencia" shows them (or the empty-state card, about as tall). */
function EntityEvidenceRows() {
  const { spacing } = useTheme();
  return (
    <GlassSurface level="thin" padding="none" style={{ minHeight: ENTITY_EVIDENCE_EMPTY_HEIGHT }} contentStyle={{ paddingHorizontal: spacing.md }}>
      {[0, 1].map((key) => <SkeletonRow key={key} lines={3} />)}
    </GlassSurface>
  );
}

/** "Evidencia" content while the events load on their own, after the entity is already on screen. */
export function EntityEvidenceSkeleton() {
  return (
    <SkeletonGroup>
      <EntityEvidenceRows />
    </SkeletonGroup>
  );
}

/** The merge sheet's matches while the search runs: one row in a thin card. */
export function EntityMatchesSkeleton() {
  return (
    <SkeletonGroup label="Cargando coincidencias">
      <GlassSurface level="thin" padding="none">
        <SkeletonRow lines={2} leading={false} trailing />
      </GlassSurface>
    </SkeletonGroup>
  );
}

/** Detalle del elemento before the entity arrives: identity card, other names, connections and evidence. */
export function EntityDetailSkeleton() {
  const { spacing, radius } = useTheme();
  return (
    <SkeletonGroup style={{ gap: 22 }}>
      <EntityHeroCardSkeleton />

      <SkeletonSection titleWidth={112} subtitleWidth="64%">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {Array.from({ length: ENTITY_ALIAS_COUNT }).map((_, index) => <SkeletonBlock key={index} width={[104, 128, 88][index % 3]} height={ENTITY_ALIAS_CHIP_HEIGHT} radius={999} />)}
        </View>
      </SkeletonSection>

      <SkeletonSection titleWidth={104} subtitleWidth="82%">
        <GlassSurface level="thin" padding="md" contentStyle={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {[96, 120, 84, 108].map((width, index) => <SkeletonBlock key={index} width={width} height={28} radius={radius.sm} />)}
          </View>
          {[0, 1, 2].map((key) => (
            <View key={key} style={{ paddingVertical: 4 }}>
              <SkeletonLine width={key === 1 ? '52%' : '68%'} lineHeight={16} />
            </View>
          ))}
        </GlassSurface>
      </SkeletonSection>

      <SkeletonSection titleWidth={88} subtitleWidth="74%">
        <EntityEvidenceRows />
      </SkeletonSection>
    </SkeletonGroup>
  );
}
