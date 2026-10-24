import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { readStoredValue, writeStoredValue } from './storage';
import { AppSettings } from './domain';
import { createBrainIAClient, BrainIAClient } from './api';
import { themeRegistry, ThemeTokens } from './themes';
import { syncNotificationBridgeConfig } from './notification-bridge';
import { applyRules, ensureRulesLoaded, getRules } from './rules';

const STORAGE_PREFIX = 'brainia_mobile';
const KEY_BASE_URL = `${STORAGE_PREFIX}.baseUrl`;
const KEY_API_KEY = `${STORAGE_PREFIX}.apiKey`;
const KEY_CLIENT_ID = `${STORAGE_PREFIX}.clientId`;
const KEY_FINANCIAL_PERIOD_START_DAY = `${STORAGE_PREFIX}.financialPeriodStartDay`;
const KEY_DASHBOARD_MODE = `${STORAGE_PREFIX}.dashboardMode`;
const KEY_DATA_VISIBILITY = `${STORAGE_PREFIX}.dataVisibility`;
const KEY_DIGEST_NOTIFICATIONS = `${STORAGE_PREFIX}.digestNotifications`;
const KEY_REVIEW_NOTIFICATIONS = `${STORAGE_PREFIX}.reviewNotifications`;

const defaultBaseUrl = process.env.EXPO_PUBLIC_BRAINIA_API_BASE_URL?.trim() || 'https://brain-ia-six.vercel.app';

const defaultSettings: AppSettings = {
  themeId: 'intelligence-console',
  baseUrl: defaultBaseUrl,
  apiKey: 'cf4e73dc8cc594d2569f51c6c5e024c0f5ffcb1986078e84c8ace7197d99456d',
  clientId: '',
  financialPeriodStartDay: 1,
  dashboardMode: 'balanced',
  dataVisibility: 'balanced',
  digestNotifications: true,
  reviewNotifications: true,
};

type AppStateValue = {
  hydrated: boolean;
  settings: AppSettings;
  theme: ThemeTokens;
  client: BrainIAClient;
  /** Bumps after a financial mutation so every mounted money view reloads. */
  financialDataRevision: number;
  invalidateFinancialData: () => void;
  setBaseUrl: (baseUrl: string) => void;
  setApiKey: (apiKey: string) => void;
  setClientId: (clientId: string) => void;
  setFinancialPeriodStartDay: (financialPeriodStartDay: number) => void;
  setDashboardMode: (dashboardMode: AppSettings['dashboardMode']) => void;
  setDataVisibility: (dataVisibility: AppSettings['dataVisibility']) => void;
  setDigestNotifications: (digestNotifications: boolean) => void;
  setReviewNotifications: (reviewNotifications: boolean) => void;
  resetSettings: () => Promise<void>;
  refreshSettings: () => Promise<void>;
};

const AppStateContext = createContext<AppStateValue | null>(null);

function normalizeFinancialPeriodStartDay(value: string | number | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 28
    ? parsed
    : defaultSettings.financialPeriodStartDay;
}

async function loadSettings(): Promise<AppSettings> {
  const [baseUrl, apiKey, clientId, storedFinancialPeriodStartDay] = await Promise.all([
    readStoredValue(KEY_BASE_URL),
    readStoredValue(KEY_API_KEY),
    readStoredValue(KEY_CLIENT_ID),
    readStoredValue(KEY_FINANCIAL_PERIOD_START_DAY),
  ]);
  const [dashboardMode, dataVisibility, digestNotifications, reviewNotifications] = await Promise.all([
    readStoredValue(KEY_DASHBOARD_MODE),
    readStoredValue(KEY_DATA_VISIBILITY),
    readStoredValue(KEY_DIGEST_NOTIFICATIONS),
    readStoredValue(KEY_REVIEW_NOTIFICATIONS),
  ]);

  return {
    themeId: 'intelligence-console',
    baseUrl: baseUrl?.trim() || defaultSettings.baseUrl,
    // The built-in key is the source of truth for this personal build; a saved key from an earlier setup is ignored.
    apiKey: defaultSettings.apiKey || apiKey || '',
    // Legacy value from an earlier setup; the backend has no such client, so it is ignored.
    clientId: clientId && clientId !== 'brainia-personal' ? clientId : defaultSettings.clientId,
    financialPeriodStartDay: normalizeFinancialPeriodStartDay(storedFinancialPeriodStartDay),
    dashboardMode: (dashboardMode as AppSettings['dashboardMode']) || defaultSettings.dashboardMode,
    dataVisibility: (dataVisibility as AppSettings['dataVisibility']) || defaultSettings.dataVisibility,
    digestNotifications: digestNotifications ? digestNotifications === 'true' : defaultSettings.digestNotifications,
    reviewNotifications: reviewNotifications ? reviewNotifications === 'true' : defaultSettings.reviewNotifications,
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [hydrated, setHydrated] = useState(false);
  const [financialDataRevision, setFinancialDataRevision] = useState(0);

  useEffect(() => {
    let active = true;

    loadSettings()
      .then((nextSettings) => {
        if (!active) {
          return;
        }
        setSettings(nextSettings);
      })
      .finally(() => {
        if (active) {
          setHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void writeStoredValue(KEY_BASE_URL, settings.baseUrl);
    void writeStoredValue(KEY_API_KEY, settings.apiKey);
    void writeStoredValue(KEY_CLIENT_ID, settings.clientId);
    void writeStoredValue(KEY_FINANCIAL_PERIOD_START_DAY, String(settings.financialPeriodStartDay));
    void writeStoredValue(KEY_DASHBOARD_MODE, settings.dashboardMode);
    void writeStoredValue(KEY_DATA_VISIBILITY, settings.dataVisibility);
    void writeStoredValue(KEY_DIGEST_NOTIFICATIONS, String(settings.digestNotifications));
    void writeStoredValue(KEY_REVIEW_NOTIFICATIONS, String(settings.reviewNotifications));
  }, [hydrated, settings]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void syncNotificationBridgeConfig({
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      clientId: settings.clientId,
    });
  }, [hydrated, settings.apiKey, settings.baseUrl, settings.clientId]);

  const client = useMemo<BrainIAClient>(() => {
    const base = createBrainIAClient({
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      clientId: settings.clientId,
    });
    // The user's rules fill in what the backend could not tell (currency, category, account) wherever movements are read.
    return {
      ...base,
      async listTransactions(...args: Parameters<typeof base.listTransactions>) {
        const [items] = await Promise.all([base.listTransactions(...args), ensureRulesLoaded()]);
        return items.map((item) => applyRules(item, getRules()));
      },
      async getTransaction(...args: Parameters<typeof base.getTransaction>) {
        const [item] = await Promise.all([base.getTransaction(...args), ensureRulesLoaded()]);
        return applyRules(item, getRules());
      },
    };
  }, [settings.apiKey, settings.baseUrl, settings.clientId]);

  const value: AppStateValue = useMemo(
    () => ({
      hydrated,
      settings,
      theme: themeRegistry['intelligence-console'],
      client,
      financialDataRevision,
      invalidateFinancialData: () => setFinancialDataRevision((revision) => revision + 1),
      setBaseUrl: (baseUrl) => setSettings((current) => ({ ...current, baseUrl })),
      setApiKey: (apiKey) => setSettings((current) => ({ ...current, apiKey })),
      setClientId: (clientId) => setSettings((current) => ({ ...current, clientId })),
      setFinancialPeriodStartDay: (financialPeriodStartDay) =>
        setSettings((current) => ({
          ...current,
          financialPeriodStartDay: normalizeFinancialPeriodStartDay(financialPeriodStartDay),
        })),
      setDashboardMode: (dashboardMode) => setSettings((current) => ({ ...current, dashboardMode })),
      setDataVisibility: (dataVisibility) => setSettings((current) => ({ ...current, dataVisibility })),
      setDigestNotifications: (digestNotifications) => setSettings((current) => ({ ...current, digestNotifications })),
      setReviewNotifications: (reviewNotifications) => setSettings((current) => ({ ...current, reviewNotifications })),
      resetSettings: async () => {
        await Promise.all([
          writeStoredValue(KEY_BASE_URL, defaultSettings.baseUrl),
          writeStoredValue(KEY_API_KEY, defaultSettings.apiKey),
          writeStoredValue(KEY_CLIENT_ID, defaultSettings.clientId),
          writeStoredValue(KEY_FINANCIAL_PERIOD_START_DAY, String(defaultSettings.financialPeriodStartDay)),
          writeStoredValue(KEY_DASHBOARD_MODE, defaultSettings.dashboardMode),
          writeStoredValue(KEY_DATA_VISIBILITY, defaultSettings.dataVisibility),
          writeStoredValue(KEY_DIGEST_NOTIFICATIONS, String(defaultSettings.digestNotifications)),
          writeStoredValue(KEY_REVIEW_NOTIFICATIONS, String(defaultSettings.reviewNotifications)),
        ]);
        setSettings(defaultSettings);
      },
      refreshSettings: async () => {
        const next = await loadSettings();
        setSettings(next);
      },
    }),
    [client, financialDataRevision, hydrated, settings]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);

  if (!value) {
    throw new Error('useAppState must be used within AppStateProvider');
  }

  return value;
}

export function useTheme() {
  return useAppState().theme;
}

export function useBrainIAClient() {
  return useAppState().client;
}

export function useSettings() {
  const { settings } = useAppState();
  return settings;
}
