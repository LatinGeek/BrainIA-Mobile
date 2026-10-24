import { SkeletonBlock, SkeletonGroup, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { SkeletonRow, SkeletonSection, SkeletonSignalCard, SkeletonTitleLines } from './parts';

const BUTTON_HEIGHT = 48;
const GROUP_GAP = 22;
/* The loading Screen has no title (header stays at the 44pt back button); a typical two-line title pushes the content down ~20pt (device-measured), no more than the group gap: reserve it as space, not as a bar. */
const TITLE_EXTRA_LINES = 0;
const TITLE_TRIM = -20;
const ATTRIBUTE_ROWS = 4;
/** The lead card is the `block` form: a fixed one-line title over a typical three-line interpretation. */
const SUMMARY_LINES = 3;

/** Actividad: Interpretación (card, attribute rows), Contenido original and Acciones. */
export function EventDetailSkeleton() {
  return (
    <SkeletonGroup style={{ gap: GROUP_GAP }}>
      <SkeletonTitleLines lines={TITLE_EXTRA_LINES} gap={GROUP_GAP} trim={TITLE_TRIM} />
      <SkeletonSection titleWidth={110} subtitle={false}>
        <SkeletonSignalCard variant="card" titleLines={1} summaryLines={SUMMARY_LINES} />
        <GlassSurface level="thin" padding="none">
          {Array.from({ length: ATTRIBUTE_ROWS }).map((_, index) => <SkeletonRow key={index} leading={false} />)}
        </GlassSurface>
      </SkeletonSection>

      <SkeletonSection titleWidth={136} subtitle={false}>
        <GlassSurface level="thin" padding="md" contentStyle={{ gap: 8 }}>
          <SkeletonBlock width={92} height={24} radius={999} />
          <SkeletonLine width="60%" lineHeight={21} />
          <SkeletonLine lineHeight={21} />
          <SkeletonLine lineHeight={21} />
          <SkeletonLine width="52%" lineHeight={21} />
        </GlassSurface>
      </SkeletonSection>

      <SkeletonSection titleWidth={84} subtitleWidth="72%">
        <SkeletonBlock height={BUTTON_HEIGHT} radius={999} />
      </SkeletonSection>
    </SkeletonGroup>
  );
}
