import { createContext, ReactNode, RefObject, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

type BlurTargetContextValue = {
  targetRef: RefObject<View | null>;
  /** Changes whenever the focused screen's blur target mounts or changes. */
  version: number;
  setTarget: (node: View | null) => void;
};

const BlurTargetContext = createContext<BlurTargetContextValue | null>(null);

/**
 * expo-blur SDK 55+ needs a BlurTargetView ref on Android. The focused Screen
 * registers its content view here; the dock and other floating chrome consume
 * the same ref. iOS and web ignore the target.
 */
export function BlurTargetProvider({ children }: { children: ReactNode }) {
  const targetRef = useRef<View | null>(null);
  const [version, setVersion] = useState(0);

  const setTarget = useCallback((node: View | null) => {
    if (targetRef.current === node) return;
    targetRef.current = node;
    setVersion((value) => value + 1);
  }, []);

  const value = useMemo(() => ({ targetRef, version, setTarget }), [setTarget, version]);

  return <BlurTargetContext.Provider value={value}>{children}</BlurTargetContext.Provider>;
}

export function useBlurTarget() {
  return useContext(BlurTargetContext);
}
