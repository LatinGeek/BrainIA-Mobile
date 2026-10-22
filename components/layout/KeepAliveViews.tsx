import { ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { GlassScrollContext } from '@/components/glass/GlassScroll';
import { StaggerGroup } from '@/components/layout/Screen';
import { useTheme } from '@/lib/app-state';

/**
 * Segments of one screen (Resumen / Cuentas / Movimientos). A segment is mounted the first time it is opened and then
 * kept: switching back is a visibility change plus the rise, not a rebuild of the whole tree (which stalled a mid-range
 * phone for 130-240 ms and left an empty screen in between).
 */
export function KeepAliveViews<T extends string>({
  active,
  views,
  enterKey = 0,
  startIndex = 0,
}: {
  active: T;
  views: Record<T, () => ReactNode>;
  /** Passed in by Screen so the first entrance of the screen still plays. */
  enterKey?: number;
  startIndex?: number;
}) {
  const [visited, setVisited] = useState<T[]>([active]);
  // Derived from props, so it is adjusted while rendering rather than in an effect.
  if (!visited.includes(active)) setVisited([...visited, active]);

  return (
    <>
      {visited.map((name) => (
        <Pane key={name} active={name === active} screenEnterKey={enterKey} startIndex={startIndex}>
          {views[name]()}
        </Pane>
      ))}
    </>
  );
}
KeepAliveViews.screenStaggerGroup = true;

function Pane({ active, screenEnterKey, startIndex, children }: { active: boolean; screenEnterKey: number; startIndex: number; children: ReactNode }) {
  const { motion: M } = useTheme();
  const parentScroll = useContext(GlassScrollContext);
  const [shown, setShown] = useState(active);
  const [showKey, setShowKey] = useState(0);
  const [settled, setSettled] = useState(0);
  const reveal = useSharedValue(active ? 1 : 0);
  // Each time the pane is shown again its rise replays.
  if (shown !== active) {
    setShown(active);
    if (active) setShowKey((key) => key + 1);
  }

  // The children reset their rise in their own effects first; revealing afterwards cannot flash finished content.
  useEffect(() => {
    reveal.value = active ? 1 : 0;
  }, [active, reveal]);

  // Glass backdrops are offset by where the card sits; once the rise has finished, measure it again.
  useEffect(() => {
    if (!showKey) return undefined;
    const timer = setTimeout(() => setSettled((value) => value + 1), M.duration.enter + M.staggerMax * M.stagger + 40);
    return () => clearTimeout(timer);
  }, [showKey, M.duration.enter, M.stagger, M.staggerMax]);

  const glassScroll = useMemo(
    () => ({ y: parentScroll?.y ?? null, x: parentScroll?.x ?? null, settled: (parentScroll?.settled ?? 0) + settled }),
    [parentScroll, settled],
  );
  const style = useAnimatedStyle(() => ({ opacity: reveal.value }));

  return (
    <GlassScrollContext.Provider value={glassScroll}>
      <Animated.View style={[active ? null : { display: 'none' }, style]}>
        <StaggerGroup enterKey={screenEnterKey * 1000 + showKey} startIndex={startIndex}>{children}</StaggerGroup>
      </Animated.View>
    </GlassScrollContext.Provider>
  );
}
