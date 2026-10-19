import { DependencyList, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

export function useAsyncResource<T>(loader: () => Promise<T>, deps: DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const refresh = useMemo(() => () => setRefreshIndex((value) => value + 1), []);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (active) {
          setData(result);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load data');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [loader, refreshIndex, ...deps]);

  return { data, loading, error, refresh };
}


function useAccessibilityFlag(
  read: () => Promise<boolean>,
  eventName: 'reduceMotionChanged' | 'reduceTransparencyChanged',
  webQuery: string
) {
  const [enabled, setEnabled] = useState(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(webQuery).matches;
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(webQuery) : null;
      if (!media) return;
      const onChange = (event: MediaQueryListEvent) => setEnabled(event.matches);
      media.addEventListener?.('change', onChange);
      return () => media.removeEventListener?.('change', onChange);
    }

    let active = true;
    read()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(eventName, setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [eventName, read, webQuery]);

  return enabled;
}

const readReduceMotion = () => AccessibilityInfo.isReduceMotionEnabled();
// Android has no reduce-transparency setting; the promise resolves false there.
const readReduceTransparency = () =>
  Platform.OS === 'ios' ? AccessibilityInfo.isReduceTransparencyEnabled() : Promise.resolve(false);

/** True when the user asked the OS to reduce motion. */
export function useReduceMotion() {
  return useAccessibilityFlag(readReduceMotion, 'reduceMotionChanged', '(prefers-reduced-motion: reduce)');
}

/** True when the user asked the OS to reduce transparency; glass then renders as `theme.glass.solid`. */
export function useReduceTransparency() {
  return useAccessibilityFlag(readReduceTransparency, 'reduceTransparencyChanged', '(prefers-reduced-transparency: reduce)');
}
