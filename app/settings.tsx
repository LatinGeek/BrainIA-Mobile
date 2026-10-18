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
import { AppSettings } from '@/lib/domain';
import { UYU_PER_USD } from '@/lib/format';
import { useAsyncResource } from '@/lib/hooks';
import { allowCredentialRecovery, enrollV2AccessToken, logoutV2Session, readV2Credential, revokeV2AccessToken, rotateV2AccessToken, type V2CredentialSnapshot } from '@/lib/storage';
import { flushNotificationBridgeDiagnostics, getInstalledCaptureApps, getNotificationBridgeStatus, openNotificationBridgeSettings, reconcileActiveNotifications, setCaptureAppPackages } from '@/lib/notification-bridge';

const dashboardModes = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'finance', label: 'Finanzas' },
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
  const [appSelectionSaving, setAppSelectionSaving] = useState(false);
  const [credentialState, setCredentialState] = useState<V2CredentialSnapshot | null>(null);
  const [credentialSheetOpen, setCredentialSheetOpen] = useState(false);
  const [credentialMode, setCredentialMode] = useState<'enroll' | 'rotate'>('enroll');
  const [credentialTokenDraft, setCredentialTokenDraft] = useState('');
  const [credentialExpiryDraft, setCredentialExpiryDraft] = useState('');
  const [credentialBusy, setCredentialBusy] = useState(false);
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

  const refreshCredentialState = useCallback(async () => {
    setCredentialState(await readV2Credential());
  }, []);

  useFocusEffect(useCallback(() => {
    refreshNotificationBridge();
    void refreshCredentialState();
  }, [refreshCredentialState, refreshNotificationBridge]));

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
  const saveCaptureSelection = async (next: typeof captureApps) => {
    if (appSelectionSaving) return;
    setAppSelectionSaving(true);
    try {
      await setCaptureAppPackages(next.filter((app) => app.selected).map((app) => app.packageName));
      setCaptureApps(next);
      refreshNotificationBridge();
    } catch {
      Alert.alert('No se guardó la selección', 'Intenta de nuevo. Tu selección anterior sigue vigente.');
    } finally {
      setAppSelectionSaving(false);
    }
  };
  const toggleCaptureApp = (packageName: string) => {
    void saveCaptureSelection(captureApps.map((app) => app.packageName === packageName ? { ...app, selected: !app.selected } : app));
  };

  const openCredentialSheet = (mode: 'enroll' | 'rotate') => {
    allowCredentialRecovery('v2AccessToken');
    setCredentialMode(mode);
    setCredentialTokenDraft('');
    setCredentialExpiryDraft('');
    setCredentialSheetOpen(true);
  };

  const saveCredential = async () => {
    if (credentialBusy) return;
    setCredentialBusy(true);
    try {
      const input = { token: credentialTokenDraft, expiresAt: credentialExpiryDraft.trim() || null };
      const next = credentialMode === 'rotate' ? await rotateV2AccessToken(input) : await enrollV2AccessToken(input);
      setCredentialState(next);
      setCredentialTokenDraft('');
      setCredentialExpiryDraft('');
      setCredentialSheetOpen(false);
      Alert.alert('Sesión segura guardada', 'La credencial quedó cifrada en el almacén seguro del dispositivo.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      Alert.alert('No se guardó la credencial', message.includes('expired') ? 'La fecha de vencimiento ya pasó. Revisa el valor e intenta de nuevo.' : 'Revisa la credencial e intenta de nuevo. No se mostró ni se registró el valor.');
    } finally {
      setCredentialBusy(false);
    }
  };

  const confirmRevokeCredential = () => {
    Alert.alert('Revocar credencial v2', 'La entrega de observaciones v2 quedará bloqueada hasta que vuelvas a conectar una sesión.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Revocar', style: 'destructive', onPress: () => { void (async () => { setCredentialBusy(true); try { setCredentialState(await revokeV2AccessToken()); } finally { setCredentialBusy(false); } })(); } },
    ]);
  };

  const confirmLogout = () => {
    Alert.alert('Cerrar sesión v2', 'Se eliminará la credencial del almacén seguro de este dispositivo. La captura seguirá funcionando solo si sus credenciales v1 siguen configuradas.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => { void (async () => { setCredentialBusy(true); try { setCredentialState(await logoutV2Session()); } finally { setCredentialBusy(false); } })(); } },
    ]);
  };

  const clearLocalData = async () => {
    await clearAllJsonCache();
    await clearDiagnostics();
    await refresh();
    await refreshDiagnostics();
  };

  const credentialStatus = credentialState?.status ?? 'unconfigured';
  const credentialSummary = credentialStatus === 'active'
    ? `Sesión activa (generación ${credentialState?.generation ?? 1}).${credentialState?.expiresAt ? ` Vence ${new Date(credentialState.expiresAt).toLocaleDateString()}.` : ' Sin vencimiento declarado.'}`
    : credentialStatus === 'expired'
      ? 'La credencial venció. Vuelve a conectar una sesión para reanudar la entrega v2.'
      : credentialStatus === 'revoked'
        ? 'La sesión v2 se cerró. No se enviará nada hasta que vuelvas a conectar.'
        : credentialStatus === 'recovery_required'
          ? 'No pudimos leer la credencial guardada. Vuelve a iniciar sesión; no se usará ninguna copia insegura.'
          : 'Aún no hay una sesión v2 configurada. La captura v2 no se enviará hasta que la conectes.';
  const credentialNeedsRotation = credentialStatus === 'active' || credentialStatus === 'expired' || credentialStatus === 'recovery_required';

  return (
    <AppScreen>
      <TopBar
        showBack
        backLabel="Listo"
        title="Ajustes"
        subtitle="Personaliza tu experiencia y administra tus fuentes."
        secondaryAction={<StatusBadge label={data?.ok ? 'Connected' : loading ? 'Checking' : 'Saved'} tone={data?.ok ? 'positive' : 'neutral'} />}
      />

      <Section title="Idioma" subtitle="La interfaz está en español. La evidencia conserva su idioma original.">
        <Surface variant="subtle">
          <ListRow title="Idioma de la aplicación" subtitle="Español" description="Brain IA comprende información en español e inglés." />
        </Surface>
      </Section>

      <Section title="Finanzas" subtitle="Configura tu ciclo mensual y la presencia de Dinero en la vista de Hoy.">
        <ListRow
          title={`${UYU_PER_USD.toFixed(4)} UYU/USD`}
          subtitle="Tipo de cambio de referencia"
          description="Los totales convertidos son estimaciones. Cada transacción conserva siempre su moneda original."
        />
        <Surface variant="subtle">
          <ListRow
            title={`${ordinalDay(settings.financialPeriodStartDay)} of each month`}
            subtitle="Inicio del ciclo financiero"
            description={`Monthly reports run from the ${ordinalDay(settings.financialPeriodStartDay)} through the day before the next cycle.`}
            trailing={<Text style={[theme.typography.bodyStrong, { color: theme.colors.accentStrong }]}>Cambio</Text>}
            onPress={openFinancialPeriod}
          />
        </Surface>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Prioridad en Hoy</Text>
        <SegmentedControl
          value={settings.dashboardMode}
          onChange={(value) => setDashboardMode(value as AppSettings['dashboardMode'])}
          options={dashboardModes}
        />
      </Section>

      <Section title="Fuentes de datos" subtitle="Controla cuánto detalle de las fuentes aparece en las pantallas habituales.">
        <SegmentedControl
          value={settings.dataVisibility}
          onChange={(value) => setDataVisibility(value as AppSettings['dataVisibility'])}
          options={visibilityModes}
        />
      </Section>

      <Section title="Notificaciones" subtitle="Recibe recordatorios para lecturas y decisiones útiles.">
        <ToggleRow title="Recordatorios de resúmenes" subtitle="Un aviso periódico cuando haya un nuevo resumen útil." value={settings.digestNotifications} onValueChange={setDigestNotifications} />
        <ToggleRow title="Recordatorios de revisión" subtitle="Un recordatorio cuando un nombre o una categoría necesiten una decisión." value={settings.reviewNotifications} onValueChange={setReviewNotifications} />
      </Section>

      {Platform.OS === 'android' ? (
        <Section
          title="Captura de notificaciones"
          subtitle="Lee notificaciones de Santander, Mercado Pago y Google Wallet desde Android y las envía a Brain IA."
        >
          <Surface variant="subtle" style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Acceso a notificaciones</Text>
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
              {notificationBridgeStatus?.captureConsent === 'unconfigured'
                ? 'Elige qué aplicaciones pueden compartir notificaciones. Hasta que elijas, no se captura ninguna.'
                : notificationBridgeStatus?.captureConsent === 'empty'
                  ? 'Captura pausada: no seleccionaste ninguna aplicación.'
                  : 'Solo se capturan notificaciones de las aplicaciones que seleccionaste. Puedes quitar todas para pausar la captura.'}
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
            <Button label="Elegir aplicaciones" onPress={openAppSelection} variant="secondary" />
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
              <Button label="Abrir acceso a notificaciones" onPress={() => { void openNotificationBridgeSettings(); }} variant="primary" />
              <Button label={checkingActiveNotifications ? 'Checking active notifications...' : 'Check active notifications'} onPress={() => { void refreshNotificationBridgeStatus(); }} variant="secondary" disabled={checkingActiveNotifications} />
              <Button label={sendingListenerDiagnostics ? 'Sending diagnostics...' : 'Send listener diagnostics'} onPress={() => { void sendListenerDiagnostics(); }} variant="secondary" disabled={sendingListenerDiagnostics} />
            </View>
          </Surface>
        </Section>
      ) : null}

      <Section title="Avanzado" subtitle="Conexión y mantenimiento.">
        <Button label={advancedOpen ? 'Hide advanced tools' : 'Show advanced tools'} onPress={() => setAdvancedOpen((current) => !current)} variant="secondary" />
        {advancedOpen ? (
          <Surface variant="subtle" style={{ gap: theme.spacing.md }}>
            <Input label="Base URL" value={settings.baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" autoCorrect={false} />
            <Input label="Client ID" value={settings.clientId} onChangeText={(value) => { allowCredentialRecovery('clientId'); setClientId(value); }} autoCapitalize="none" autoCorrect={false} placeholder="opcional" />
            <Input label="API key" value={settings.apiKey} onChangeText={(value) => { allowCredentialRecovery('apiKey'); setApiKey(value); }} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="opcional" />

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Sesión de datos v2</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{credentialSummary}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                La credencial se guarda cifrada con Keystore y queda excluida de respaldos, diagnósticos y registros.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {credentialNeedsRotation ? (
                  <Button label={credentialStatus === 'active' ? 'Rotar credencial' : 'Volver a conectar'} onPress={() => openCredentialSheet(credentialStatus === 'active' ? 'rotate' : 'enroll')} variant="primary" />
                ) : (
                  <Button label="Conectar sesión v2" onPress={() => openCredentialSheet('enroll')} variant="primary" />
                )}
                {credentialStatus === 'active' || credentialStatus === 'expired' ? (
                  <Button label="Revocar credencial" onPress={confirmRevokeCredential} variant="secondary" disabled={credentialBusy} />
                ) : null}
                {credentialStatus !== 'unconfigured' ? (
                  <Button label="Cerrar sesión" onPress={confirmLogout} variant="secondary" disabled={credentialBusy} />
                ) : null}
              </View>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Conexión</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {loading ? 'Checking connection...' : error ? error : data?.ok ? 'Service reachable.' : 'Service is not responding right now.'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button label={loading ? 'Checking...' : 'Check service'} onPress={refresh} variant="secondary" />
                <Button label="Recuperar valores guardados" onPress={refreshSettings} variant="ghost" />
              </View>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Diagnóstico</Text>
              {diagnostics?.[0] ? (
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {diagnostics[0].label} · {new Date(diagnostics[0].timestamp).toLocaleString()}
                </Text>
              ) : (
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>No hay diagnósticos registrados.</Text>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button label="Actualizar diagnóstico" onPress={refreshDiagnostics} variant="secondary" />
                <Button label="Vaciar caché" onPress={clearLocalData} variant="ghost" />
              </View>
            </View>

            <EmptyState
              title="Restablecer preferencias locales"
              description="Esto restablece la apariencia y la conexión predeterminadas de la aplicación."
              primaryActionLabel="Restablecer ajustes"
              onPrimaryAction={resetSettings}
            />
          </Surface>
        ) : null}
      </Section>

      <BottomSheet visible={financialPeriodOpen} title="Ciclo financiero" onClose={() => setFinancialPeriodOpen(false)}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Choose when a new monthly money cycle begins. Day 28, for example, creates cycles from the 28th through the 27th.</Text>
        <Input label="Día de inicio (1–28)" value={financialPeriodDraft} onChangeText={setFinancialPeriodDraft} keyboardType="number-pad" placeholder="1" />
        <Button label="Guardar ciclo financiero" onPress={saveFinancialPeriod} />
      </BottomSheet>

      <BottomSheet visible={appSelectionOpen} title="Aplicaciones de origen" onClose={() => setAppSelectionOpen(false)}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Elige las aplicaciones instaladas cuyas notificaciones puede capturar Brain IA.</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Sin aplicaciones seleccionadas no se captura ninguna notificación.</Text>
          <Button label={appSelectionSaving ? 'Guardando…' : 'Pausar toda la captura'} disabled={appSelectionLoading || appSelectionSaving} onPress={() => { void saveCaptureSelection(captureApps.map((app) => ({ ...app, selected: false }))); }} variant="secondary" />
          {appSelectionLoading ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Buscando aplicaciones instaladas…</Text> : null}
          {!appSelectionLoading && !captureApps.length ? <EmptyState title="No se encontraron aplicaciones" description="Actualiza la lista después de instalar una aplicación." primaryActionLabel="Reintentar" onPrimaryAction={() => { void refreshCaptureApps(); }} /> : null}
          {captureApps.map((app) => <ToggleRow key={app.packageName} title={app.name} subtitle={app.packageName} value={app.selected} onValueChange={() => toggleCaptureApp(app.packageName)} />)}
        </View>
      </BottomSheet>

      <BottomSheet visible={credentialSheetOpen} title={credentialMode === 'rotate' ? 'Rotar credencial v2' : 'Conectar sesión v2'} onClose={() => setCredentialSheetOpen(false)}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Pega la credencial de dispositivo emitida por Brain IA. Se guarda cifrada y no se muestra de nuevo.
          </Text>
          <Input
            label="Credencial de dispositivo"
            value={credentialTokenDraft}
            onChangeText={setCredentialTokenDraft}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            placeholder="Obligatoria"
          />
          <Input
            label="Vencimiento (opcional)"
            value={credentialExpiryDraft}
            onChangeText={setCredentialExpiryDraft}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="2027-01-31T00:00:00Z"
          />
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            Sin vencimiento declarado, la credencial se usa hasta que la revoques o cierres sesión.
          </Text>
          <Button
            label={credentialBusy ? 'Guardando…' : credentialMode === 'rotate' ? 'Guardar rotación' : 'Guardar credencial'}
            onPress={() => { void saveCredential(); }}
            disabled={credentialBusy || credentialTokenDraft.trim().length === 0}
          />
        </View>
      </BottomSheet>
    </AppScreen>
  );
}
