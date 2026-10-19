import { makeMutable } from 'react-native-reanimated';

/**
 * One shared scroll signal for the dock. Screens write 0..1 (0 = expanded,
 * 1 = minimized); the custom tab bar reads it on the UI thread.
 */
export const dockScroll = makeMutable(0);
