import { DependencyList, useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

export function useAsyncResource<T>(loader: () => Promise<T>, deps: DependencyList = []) {  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const refresh = useMemo(() => () => setRefreshIndex((value) => value + 1), []);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loader();
      setData(result);
      return result;
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'No se pudieron cargar los datos';
      setError(message);
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, [loader]);

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
          setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los datos');
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

  return { data, loading, error, refresh, reload };
}

function useAccessibilityFlag(check: (() => Promise<boolean>) | undefined, event: 'reduceMotionChanged' | 'reduceTransparencyChanged', initial = false) {
  const [enabled, setEnabled] = useState(initial);

  useEffect(() => {
    let active = true;
    try {
      if (typeof check === 'function') {
        void check().then((value) => { if (active) setEnabled(value); }).catch(() => undefined);
      }
    } catch {
      // Platform does not implement this accessibility query (for example web).
    }
    let subscription: { remove: () => void } | undefined;
    try {
      subscription = AccessibilityInfo.addEventListener(event, (value: boolean) => setEnabled(value));
    } catch {
      subscription = undefined;
    }
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [check, event]);

  return enabled;
}

/** True when the OS asks apps to avoid transparency and blur. */
export function useReduceTransparency() {
  return useAccessibilityFlag(AccessibilityInfo.isReduceTransparencyEnabled, 'reduceTransparencyChanged');
}

/** True when the OS asks apps to reduce non-essential motion. */
export function useReduceMotion() {
  const initial = useReducedMotion();
  return useAccessibilityFlag(AccessibilityInfo.isReduceMotionEnabled, 'reduceMotionChanged', initial);
}
