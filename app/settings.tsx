import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Platform, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  AppScreen,
  Section,
  TopBar,
} from '@/components/layout';
import { BottomSheet, Button, Input, ListRow, SegmentedControl, StatusBadge, Surface, ToggleRow } from '@/components/primitives';
import { EmptyState } from '@/components/states';
import { useAppState, useBrainIAClient, useTheme } from '@/lib/app-state';
import { clearAllJsonCache } from '@/lib/cache';
import { clearDiagnostics, readDiagnostics } from '@/lib/diagnostics';
import { AppSettings, ThemeId } from '@/lib/domain';
import { useAsyncResource } from '@/lib/hooks';
import { flushNotificationBridgeDiagnostics, getInstalledCaptureApps, getNotificationBridgeStatus, openNotificationBridgeSettings, reconcileActiveNotifications, setCaptureAppPackages } from '@/lib/notification-bridge';

const themeModes = [
  { value: 'editorial-minimal', label: 'Editorial' },
  { value: 'intelligence-console', label: 'Console' },
  { value: 'warm-knowledge', label: 'Warm' },
] as const;

const dashboardModes = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'finance', label: 'Finance' },
] as const;

const visibilityModes = [
  { value: 'essential', label: 'Essential' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Detailed' },
] as const;

function ordinalDay(day: number) {
  if (day >= 11 && day <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

export default function SettingsScreen() {
  const theme = useTheme();
  const client = useBrainIAClient();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [financialPeriodOpen, setFinancialPeriodOpen] = useState(false);
  const [financialPeriodDraft, setFinancialPeriodDraft] = useState('1');
  const [captureApps, setCaptureApps] = useState<{ packageName: string; name: string; selected: boolean }[]>([]);
  const [appSelectionOpen, setAppSelectionOpen] = useState(false);
  const [appSelectionLoading, setAppSelectionLoading] = useState(false);
  const {
    settings,
    setApiKey,
    setBaseUrl,
    setClientId,
    setDashboardMode,
    setDataVisibility,
    setDigestNotifications,
    setFinancialPeriodStartDay,
    setReviewNotifications,
    setThemeId,
    refreshSettings,
    resetSettings,
  } = useAppState();

  const openFinancialPeriod = () => {
    setFinancialPeriodDraft(String(settings.financialPeriodStartDay));
    setFinancialPeriodOpen(true);
  };

  const saveFinancialPeriod = () => {
    const day = Number(financialPeriodDraft);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      Alert.alert('Invalid start day', 'Choose a day from 1 through 28 so every month has a valid cycle boundary.');
      return;
    }
    setFinancialPeriodStartDay(day);
    setFinancialPeriodOpen(false);
  };

  const healthLoader = useMemo(() => () => client.health(), [client]);
  const { data, loading, error, refresh } = useAsyncResource(healthLoader, [healthLoader]);
  const diagnosticsLoader = useMemo(() => () => readDiagnostics(), []);
  const { data: diagnostics, refresh: refreshDiagnostics } = useAsyncResource(diagnosticsLoader, [diagnosticsLoader]);
  const notificationBridgeLoader = useMemo(() => () => getNotificationBridgeStatus(), []);
  const {
    data: notificationBridgeStatus,
    loading: notificationBridgeLoading,
    refresh: refreshNotificationBridge,
  } = useAsyncResource(notificationBridgeLoader, [notificationBridgeLoader]);
  const notificationBridgeInitialLoading = notificationBridgeLoading && !notificationBridgeStatus;
  const listenerConnected = Boolean(notificationBridgeStatus?.accessEnabled && notificationBridgeStatus.listenerReady);
  const listenerNeedsAttention = Boolean(notificationBridgeStatus?.accessEnabled && !notificationBridgeStatus.listenerReady && notificationBridgeStatus.lastError);
  const lastReceivedAt = notificationBridgeStatus?.lastReceivedAt;
  const lastForwardedAt = notificationBridgeStatus?.lastForwardedAt;
  const lastReconciledAt = notificationBridgeStatus?.lastReconciledAt;
  const refreshCaptureApps = async () => {
    setAppSelectionLoading(true);
    try {
      setCaptureApps(await getInstalledCaptureApps());
    } finally {
      setAppSelectionLoading(false);
    }
  };
  const openAppSelection = () => {
    setAppSelectionOpen(true);
    void refreshCaptureApps();
  };
  const [checkingActiveNotifications, setCheckingActiveNotifications] = useState(false);
  const [sendingListenerDiagnostics, setSendingListenerDiagnostics] = useState(false);
  const sendListenerDiagnostics = async () => {
    setSendingListenerDiagnostics(true);
    try {
      await flushNotificationBridgeDiagnostics();
      refreshNotificationBridge();
    } finally {
      setSendingListenerDiagnostics(false);
    }
  };
  const refreshNotificationBridgeStatus = async () => {
    setCheckingActiveNotifications(true);
    try {
      await reconcileActiveNotifications();
      await Promise.all([refreshCaptureApps(), refreshNotificationBridge()]);
    } finally {
      setCheckingActiveNotifications(false);
    }
  };

  useFocusEffect(useCallback(() => {
    refreshNotificationBridge();
  }, [refreshNotificationBridge]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshNotificationBridge();
    });
    return () => subscription.remove();
  }, [refreshNotificationBridge]);

  useEffect(() => {
    if (!notificationBridgeStatus?.accessEnabled || listenerConnected) return;
    const interval = setInterval(refreshNotificationBridge, 3_000);
    return () => clearInterval(interval);
  }, [listenerConnected, notificationBridgeStatus?.accessEnabled, refreshNotificationBridge]);
  const toggleCaptureApp = (packageName: string) => {
    setCaptureApps((current) => {
      const next = current.map((app) => app.packageName === packageName ? { ...app, selected: !app.selected } : app);
      setCaptureAppPackages(next.filter((app) => app.selected).map((app) => app.packageName));
      return next;
    });
  };

  const clearLocalData = async () => {
    await clearAllJsonCache();
    await clearDiagnostics();
    await refresh();
    await refreshDiagnostics();
  };

  return (
    <AppScreen>
      <TopBar
        showBack
        backLabel="Done"
        title="Settings"
        subtitle="Personalize the experience. Advanced connection tools stay out of the way."
        secondaryAction={<StatusBadge label={data?.ok ? 'Connected' : loading ? 'Checking' : 'Saved'} tone={data?.ok ? 'positive' : 'neutral'} />}
      />

      <Section title="Appearance" subtitle="Choose the visual language without changing the app structure.">
        <SegmentedControl value={settings.themeId} onChange={(value) => setThemeId(value as ThemeId)} options={themeModes} />
      </Section>

      <Section title="Language" subtitle="Current default is English; source content can remain bilingual.">
        <Surface variant="subtle">
          <ListRow title="App language" subtitle="English" description="Spanish and system language selection are planned." />
        </Surface>
      </Section>

      <Section title="Finance" subtitle="Set your monthly cycle and choose how prominently Money appears on Today.">
        <Surface variant="subtle">
          <ListRow
            title={`${ordinalDay(settings.financialPeriodStartDay)} of each month`}
            subtitle="Financial cycle starts"
            description={`Monthly reports run from the ${ordinalDay(settings.financialPeriodStartDay)} through the day before the next cycle.`}
            trailing={<Text style={[theme.typography.bodyStrong, { color: theme.colors.accentStrong }]}>Change</Text>}
            onPress={openFinancialPeriod}
          />
        </Surface>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Today emphasis</Text>
        <SegmentedControl
          value={settings.dashboardMode}
          onChange={(value) => setDashboardMode(value as AppSettings['dashboardMode'])}
          options={dashboardModes}
        />
      </Section>

      <Section title="Data sources" subtitle="Control how much source detail appears in normal screens.">
        <SegmentedControl
          value={settings.dataVisibility}
          onChange={(value) => setDataVisibility(value as AppSettings['dataVisibility'])}
          options={visibilityModes}
        />
      </Section>

      <Section title="Notifications" subtitle="Keep reminders focused on useful reading and review decisions.">
        <ToggleRow title="Digest reminders" subtitle="A periodic nudge when a new summary is useful." value={settings.digestNotifications} onValueChange={setDigestNotifications} />
        <ToggleRow title="Review reminders" subtitle="A gentle reminder when names or categories need a decision." value={settings.reviewNotifications} onValueChange={setReviewNotifications} />
      </Section>

      {Platform.OS === 'android' ? (
        <Section
          title="Notification bridge"
          subtitle="Read Santander, Mercado Pago, and Google Wallet notifications directly from Android and forward them to BrainIA."
        >
          <Surface variant="subtle" style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Listener access</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {notificationBridgeInitialLoading
                    ? 'Checking notification access...'
                    : listenerConnected
                      ? lastForwardedAt
                        ? `Listener is connected. Last forwarded ${new Date(lastForwardedAt).toLocaleString()}.`
                        : 'Listener is connected and ready for a supported notification.'
                      : notificationBridgeStatus?.accessEnabled
                        ? listenerNeedsAttention
                          ? 'Access is enabled, but Android has not connected the listener. BrainIA is retrying automatically.'
                          : 'Access is enabled. BrainIA is connecting the listener service.'
                      : 'Notification access is disabled. Open Android settings and enable BrainIA.'}
                </Text>
              </View>
              <StatusBadge
                label={notificationBridgeInitialLoading ? 'Checking' : listenerConnected ? 'Running' : listenerNeedsAttention ? 'Needs attention' : notificationBridgeStatus?.accessEnabled ? 'Reconnecting' : 'Disabled'}
                tone={notificationBridgeInitialLoading ? 'neutral' : listenerConnected ? 'positive' : 'warning'}
              />
            </View>

          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              Select any installed app whose notifications BrainIA should capture.
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              {lastReceivedAt
                ? `Last notification read successfully: ${new Date(lastReceivedAt).toLocaleString()}.`
                : 'No supported notification has been read yet.'}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              {lastReconciledAt
                ? `Active notifications last checked: ${new Date(lastReconciledAt).toLocaleString()}.`
                : 'Active notifications are checked when the listener connects, then every 30 minutes.'}
            </Text>
            <Button label="Choose notification apps" onPress={openAppSelection} variant="secondary" />
            {notificationBridgeStatus?.lastError ? <Text style={[theme.typography.caption, { color: theme.status.warning }]}>{notificationBridgeStatus.lastError}</Text> : null}
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              {notificationBridgeStatus?.queuedDiagnosticCount
                ? `${notificationBridgeStatus.queuedDiagnosticCount} listener diagnostic event${notificationBridgeStatus.queuedDiagnosticCount === 1 ? '' : 's'} waiting to upload.`
                : notificationBridgeStatus?.diagnosticsLastUploadedAt
                  ? `Listener diagnostics uploaded ${new Date(notificationBridgeStatus.diagnosticsLastUploadedAt).toLocaleString()}.`
                  : 'Listener diagnostics will upload automatically when the backend is reachable.'}
            </Text>
            {notificationBridgeStatus?.diagnosticsLastUploadError ? <Text style={[theme.typography.caption, { color: theme.status.warning }]}>{notificationBridgeStatus.diagnosticsLastUploadError}</Text> : null}
            {notificationBridgeStatus?.reconnectAttempts ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{`Reconnect attempts since the last successful connection: ${notificationBridgeStatus.reconnectAttempts}.`}</Text> : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button label="Open notification access" onPress={() => { void openNotificationBridgeSettings(); }} variant="primary" />
              <Button label={checkingActiveNotifications ? 'Checking active notifications...' : 'Check active notifications'} onPress={() => { void refreshNotificationBridgeStatus(); }} variant="secondary" disabled={checkingActiveNotifications} />
              <Button label={sendingListenerDiagnostics ? 'Sending diagnostics...' : 'Send listener diagnostics'} onPress={() => { void sendListenerDiagnostics(); }} variant="secondary" disabled={sendingListenerDiagnostics} />
            </View>
          </Surface>
        </Section>
      ) : null}

      <Section title="Advanced" subtitle="Connection and maintenance tools.">
        <Button label={advancedOpen ? 'Hide advanced tools' : 'Show advanced tools'} onPress={() => setAdvancedOpen((current) => !current)} variant="secondary" />
        {advancedOpen ? (
          <Surface variant="subtle" style={{ gap: theme.spacing.md }}>
            <Input label="Base URL" value={settings.baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" autoCorrect={false} />
            <Input label="Client ID" value={settings.clientId} onChangeText={setClientId} autoCapitalize="none" autoCorrect={false} placeholder="optional" />
            <Input label="API key" value={settings.apiKey} onChangeText={setApiKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="optional" />

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Connection</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {loading ? 'Checking connection...' : error ? error : data?.ok ? 'Service reachable.' : 'Service is not responding right now.'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button label={loading ? 'Checking...' : 'Check service'} onPress={refresh} variant="secondary" />
                <Button label="Reload saved values" onPress={refreshSettings} variant="ghost" />
              </View>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Diagnostics</Text>
              {diagnostics?.[0] ? (
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {diagnostics[0].label} · {new Date(diagnostics[0].timestamp).toLocaleString()}
                </Text>
              ) : (
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>No diagnostics recorded.</Text>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button label="Refresh diagnostics" onPress={refreshDiagnostics} variant="secondary" />
                <Button label="Clear cache" onPress={clearLocalData} variant="ghost" />
              </View>
            </View>

            <EmptyState
              title="Reset local preferences"
              description="This returns the app to the default appearance and connection settings."
              primaryActionLabel="Reset settings"
              onPrimaryAction={resetSettings}
            />
          </Surface>
        ) : null}
      </Section>

      <BottomSheet visible={financialPeriodOpen} title="Financial cycle" onClose={() => setFinancialPeriodOpen(false)}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Choose when a new monthly money cycle begins. Day 28, for example, creates cycles from the 28th through the 27th.</Text>
        <Input label="Start day (1–28)" value={financialPeriodDraft} onChangeText={setFinancialPeriodDraft} keyboardType="number-pad" placeholder="1" />
        <Button label="Save financial cycle" onPress={saveFinancialPeriod} />
      </BottomSheet>

      <BottomSheet visible={appSelectionOpen} title="Notification apps" onClose={() => setAppSelectionOpen(false)}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Choose any installed app whose notifications BrainIA can capture.</Text>
          {appSelectionLoading ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Looking for installed apps...</Text> : null}
          {!appSelectionLoading && !captureApps.length ? <EmptyState title="No installed apps found" description="Refresh the list after installing an app." primaryActionLabel="Try again" onPrimaryAction={() => { void refreshCaptureApps(); }} /> : null}
          {captureApps.map((app) => <ToggleRow key={app.packageName} title={app.name} subtitle={app.packageName} value={app.selected} onValueChange={() => toggleCaptureApp(app.packageName)} />)}
        </View>
      </BottomSheet>
    </AppScreen>
  );
}
