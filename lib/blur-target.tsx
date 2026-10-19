import { createContext, ReactNode, RefObject, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

type BlurTargetContextValue = {
  /** Ambient backdrop. Card surfaces blur this, never the content they sit in. */
  cardTargetRef: RefObject<View | null>;
  /** Scrolling content. Floating chrome (dock, header, action bar) blurs this. */
  chromeTargetRef: RefObject<View | null>;
  /** Changes whenever the focused screen's targets mount or change. */
  version: number;
  setCardTarget: (node: View | null) => void;
  setChromeTarget: (node: View | null) => void;
};

const BlurTargetContext = createContext<BlurTargetContextValue | null>(null);

/**
 * expo-blur SDK 55+ needs a BlurTargetView ref on Android. A card must not blur
 * the view it is inside, so screens expose two targets: the ambient backdrop
 * for cards and the scrolling content for floating chrome.
 */
export function BlurTargetProvider({ children }: { children: ReactNode }) {
  const cardTargetRef = useRef<View | null>(null);
  const chromeTargetRef = useRef<View | null>(null);
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((value) => value + 1), []);

  const setCardTarget = useCallback((node: View | null) => {
    if (cardTargetRef.current === node) return;
    cardTargetRef.current = node;
    bump();
  }, [bump]);

  const setChromeTarget = useCallback((node: View | null) => {
    if (chromeTargetRef.current === node) return;
    chromeTargetRef.current = node;
    bump();
  }, [bump]);

  const value = useMemo(
    () => ({ cardTargetRef, chromeTargetRef, version, setCardTarget, setChromeTarget }),
    [setCardTarget, setChromeTarget, version],
  );

  return <BlurTargetContext.Provider value={value}>{children}</BlurTargetContext.Provider>;
}

export function useBlurTarget() {
  return useContext(BlurTargetContext);
}
