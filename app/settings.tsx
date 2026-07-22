import { useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';

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
import { getInstalledCaptureApps, getNotificationBridgeStatus, openNotificationBridgeSettings, reconcileActiveNotifications, setCaptureAppPackages } from '@/lib/notification-bridge';

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

export default function SettingsScreen() {
  const theme = useTheme();
  const client = useBrainIAClient();
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
    setReviewNotifications,
    setThemeId,
    refreshSettings,
    resetSettings,
  } = useAppState();

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
  const listenerConnected = Boolean(notificationBridgeStatus?.accessEnabled && notificationBridgeStatus.listenerReady);
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
  const refreshNotificationBridgeStatus = async () => {
    setCheckingActiveNotifications(true);
    try {
      await reconcileActiveNotifications();
      await Promise.all([refreshCaptureApps(), refreshNotificationBridge()]);
    } finally {
      setCheckingActiveNotifications(false);
    }
  };
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

      <Section title="Finance preferences" subtitle="Choose whether Money or Knowledge gets more emphasis on Today.">
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
                  {notificationBridgeLoading
                    ? 'Checking notification access...'
                    : listenerConnected
                      ? lastForwardedAt
                        ? `Listener is connected. Last forwarded ${new Date(lastForwardedAt).toLocaleString()}.`
                        : 'Listener is connected and ready for a supported notification.'
                      : notificationBridgeStatus?.accessEnabled
                        ? 'Access is enabled. Reopen BrainIA to confirm the listener service connects.'
                      : 'Notification access is disabled. Open Android settings and enable BrainIA.'}
                </Text>
              </View>
              <StatusBadge
                label={notificationBridgeLoading ? 'Checking' : listenerConnected ? 'Running' : notificationBridgeStatus?.accessEnabled ? 'Starting' : 'Disabled'}
                tone={notificationBridgeLoading ? 'neutral' : listenerConnected ? 'positive' : 'warning'}
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

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button label="Open notification access" onPress={() => { void openNotificationBridgeSettings(); }} variant="primary" />
              <Button label={checkingActiveNotifications ? 'Checking active notifications...' : 'Check active notifications'} onPress={() => { void refreshNotificationBridgeStatus(); }} variant="secondary" disabled={checkingActiveNotifications} />
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
