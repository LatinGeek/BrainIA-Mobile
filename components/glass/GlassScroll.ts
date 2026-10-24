import { createContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Scroll offsets that move a glass surface relative to the fixed ambient light behind it.
 * The screen provides the vertical offset; a horizontal carousel adds its own horizontal
 * offset for the surfaces inside it. Glass surfaces slide their backdrop image against the
 * card by these offsets, so the blur keeps showing what is actually behind the card.
 */
export type GlassScroll = {
  y: SharedValue<number> | null;
  x: SharedValue<number> | null;
  /** Bumped when the screen's entrance has finished: cards measured mid-rise measure again. */
  settled?: number;
};

export const GlassScrollContext = createContext<GlassScroll | null>(null);
