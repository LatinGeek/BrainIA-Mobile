/** Width at which a screen switches from the phone layout to the rail-plus-content one. */
export const DESKTOP_BREAKPOINT = 1024;

/**
 * Horizontal inset of a screen's content, which is the padding `Screen` gives its scroll body. A rail
 * that peeks its next card cancels it to reach the screen edge, so it sizes its cards against this
 * instead of the window width: a card measured from the window alone leaves the peek clipped inside
 * the content's margin, short of the edge.
 */
export function screenGutter(windowWidth: number) {
  return windowWidth >= DESKTOP_BREAKPOINT ? 40 : 20;
}
