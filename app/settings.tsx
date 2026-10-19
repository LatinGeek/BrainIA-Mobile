import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Platform, Text, View } from 'react-native';

import { Button, Field, SegmentedControl, Tag } from '@/components/controls';
import { IconTile, Row } from '@/components/data/Row';
import { StateView } from '@/components/data/StateView';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { Screen, Section } from '@/components/layout/Screen';
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
  { value: 'finance', label: 'Money' },
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
  const { data: notificationBridgeStatus, loading: notificationBridgeLoading, refresh: refreshNotificationBridge } = useAsyncResource(notificationBridgeLoader, [notificationBridgeLoader]);
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

  const commitCredential = async () => {
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
      Alert.alert('No se guardó la credencial', /expir/i.test(message) ? 'La fecha de vencimiento no es válida o ya pasó. Usa ISO-8601 o epoch en milisegundos.' : 'Revisa la credencial e intenta de nuevo. No se mostró ni se registró el valor.');
    } finally {
      setCredentialBusy(false);
    }
  };

  const saveCredential = () => {
    if (credentialBusy) return;
    if (credentialTokenDraft.trim().length === 0) return;
    if (credentialMode === 'rotate') {
      Alert.alert('Rotar credencial v2', 'La credencial actual se reemplazará y la anterior dejará de usarse en este dispositivo. La entrega v2 continúa con la nueva generación.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Rotar', style: 'destructive', onPress: () => { void commitCredential(); } },
      ]);
      return;
    }
    void commitCredential();
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
    <Screen
      title="Ajustes"
      overline="Preferences"
      subtitle="Personaliza tu experiencia y administra tus fuentes."
      actions={<Tag label={data?.ok ? 'Connected' : loading ? 'Checking' : 'Saved'} tone={data?.ok ? 'positive' : 'neutral'} />}
    >
      <Section title="General" subtitle="La interfaz está en español. La evidencia conserva su idioma original.">
        <Row title="Idioma de la aplicación" subtitle="Español" description="Brain IA comprende información en español e inglés." leading={<IconTile icon="globe" />} accessory="none" />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Source detail</Text>
        <SegmentedControl items={visibilityModes as unknown as typeof visibilityModes} value={settings.dataVisibility} onChange={(value) => setDataVisibility(value as AppSettings['dataVisibility'])} />
      </Section>

      <Section title="Money" subtitle="Configura tu ciclo mensual y la presencia de Dinero en la vista de Hoy.">
        <Row title={`${UYU_PER_USD.toFixed(4)} UYU/USD`} subtitle="Tipo de cambio de referencia" description="Los totales convertidos son estimaciones. Cada transacción conserva siempre su moneda original." leading={<IconTile icon="repeat" color={theme.colors.model} />} accessory="none" />
        <Row title={`${ordinalDay(settings.financialPeriodStartDay)} of each month`} subtitle="Inicio del ciclo financiero" description="Monthly reports run from this day through the day before the next cycle." leading={<IconTile icon="calendar" color={theme.colors.accent} />} trailing={<Text style={[theme.typography.bodyStrong, { color: theme.colors.accentStrong }]}>Cambio</Text>} accessory="none" onPress={openFinancialPeriod} />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Prioridad en Hoy</Text>
        <SegmentedControl items={dashboardModes as unknown as typeof dashboardModes} value={settings.dashboardMode} onChange={(value) => setDashboardMode(value as AppSettings['dashboardMode'])} />
      </Section>

      <Section title="Notifications" subtitle="Recibe recordatorios para lecturas y decisiones útiles.">
        <Row title="Recordatorios de resúmenes" subtitle="Un aviso periódico cuando haya un nuevo resumen útil." leading={<IconTile icon="book-open" />} accessory="switch" switchValue={settings.digestNotifications} onSwitchChange={setDigestNotifications} />
        <Row title="Recordatorios de revisión" subtitle="Un recordatorio cuando un nombre o una categoría necesiten una decisión." leading={<IconTile icon="shield" color={theme.status.review} />} accessory="switch" switchValue={settings.reviewNotifications} onSwitchChange={setReviewNotifications} />
      </Section>

      {Platform.OS === 'android' ? (
        <Section title="Captura de notificaciones" subtitle="Lee notificaciones de apps seleccionadas y las envía a Brain IA.">
          <GlassSurface level="thin" padding="md" contentStyle={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconTile icon="bell" color={listenerConnected ? theme.colors.accent : theme.status.warning} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Acceso a notificaciones</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {notificationBridgeInitialLoading ? 'Checking notification access...' : listenerConnected ? (lastForwardedAt ? `Listener connected. Last forwarded ${new Date(lastForwardedAt).toLocaleString()}.` : 'Listener connected and ready.') : notificationBridgeStatus?.accessEnabled ? (listenerNeedsAttention ? 'Access enabled; the listener is reconnecting.' : 'Access enabled. Connecting the listener service.') : 'Notification access is disabled.'}
                </Text>
              </View>
              <Tag label={notificationBridgeInitialLoading ? 'Checking' : listenerConnected ? 'Running' : listenerNeedsAttention ? 'Needs attention' : notificationBridgeStatus?.accessEnabled ? 'Reconnecting' : 'Disabled'} tone={listenerConnected ? 'positive' : 'warning'} />
            </View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{notificationBridgeStatus?.captureConsent === 'unconfigured' ? 'Elige qué aplicaciones pueden compartir notificaciones.' : notificationBridgeStatus?.captureConsent === 'empty' ? 'Captura pausada: no seleccionaste ninguna aplicación.' : 'Solo se capturan notificaciones de las aplicaciones que seleccionaste.'}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{lastReceivedAt ? `Last notification read: ${new Date(lastReceivedAt).toLocaleString()}.` : 'No supported notification has been read yet.'}</Text>
            {lastReconciledAt ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Active notifications last checked: {new Date(lastReconciledAt).toLocaleString()}.</Text> : null}
            {notificationBridgeStatus?.lastError ? <Text style={[theme.typography.caption, { color: theme.status.warning }]}>{notificationBridgeStatus.lastError}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button label="Elegir aplicaciones" variant="secondary" size="sm" onPress={openAppSelection} />
              <Button label="Abrir acceso" size="sm" onPress={() => { void openNotificationBridgeSettings(); }} />
              <Button label={checkingActiveNotifications ? 'Checking...' : 'Check active'} variant="secondary" size="sm" onPress={() => { void refreshNotificationBridgeStatus(); }} disabled={checkingActiveNotifications} />
              <Button label={sendingListenerDiagnostics ? 'Sending...' : 'Send diagnostics'} variant="ghost" size="sm" onPress={() => { void sendListenerDiagnostics(); }} disabled={sendingListenerDiagnostics} />
            </View>
          </GlassSurface>
        </Section>
      ) : null}

      <Section title="Advanced" subtitle="Connection, credentials and maintenance.">
        <Row title="Advanced tools" subtitle={advancedOpen ? 'Hide connection and diagnostics.' : 'Show connection and diagnostics.'} leading={<IconTile icon="tool" />} accessory="expand" expanded={advancedOpen} onPress={() => setAdvancedOpen((value) => !value)} />
        {advancedOpen ? (
          <GlassSurface level="thin" padding="md" contentStyle={{ gap: 12 }}>
            <Field label="Base URL" value={settings.baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" autoCorrect={false} />
            <Field label="Client ID" value={settings.clientId} onChangeText={(value) => { allowCredentialRecovery('clientId'); setClientId(value); }} autoCapitalize="none" autoCorrect={false} placeholder="opcional" />
            <Field label="API key" value={settings.apiKey} onChangeText={(value) => { allowCredentialRecovery('apiKey'); setApiKey(value); }} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="opcional" />
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Sesión de datos v2</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{credentialSummary}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {credentialNeedsRotation ? <Button label={credentialStatus === 'active' ? 'Rotar credencial' : 'Volver a conectar'} size="sm" onPress={() => openCredentialSheet(credentialStatus === 'active' ? 'rotate' : 'enroll')} /> : <Button label="Conectar sesión v2" size="sm" onPress={() => openCredentialSheet('enroll')} />}
              {credentialStatus === 'active' || credentialStatus === 'expired' ? <Button label="Revocar" variant="secondary" size="sm" onPress={confirmRevokeCredential} disabled={credentialBusy} /> : null}
              {credentialStatus !== 'unconfigured' ? <Button label="Cerrar sesión" variant="ghost" size="sm" onPress={confirmLogout} disabled={credentialBusy} /> : null}
            </View>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Conexión</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{loading ? 'Checking connection...' : error ? error : data?.ok ? 'Service reachable.' : 'Service is not responding right now.'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button label={loading ? 'Checking...' : 'Check service'} variant="secondary" size="sm" onPress={refresh} />
              <Button label="Recuperar valores" variant="ghost" size="sm" onPress={refreshSettings} />
            </View>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Diagnóstico</Text>
            {diagnostics?.[0] ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{diagnostics[0].label} · {new Date(diagnostics[0].timestamp).toLocaleString()}</Text> : <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>No hay diagnósticos registrados.</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button label="Actualizar diagnóstico" variant="secondary" size="sm" onPress={refreshDiagnostics} />
              <Button label="Vaciar caché" variant="ghost" size="sm" onPress={clearLocalData} />
            </View>
            <StateView title="Restablecer preferencias locales" description="Esto restablece la apariencia y la conexión predeterminadas de la aplicación." actionLabel="Restablecer ajustes" onAction={resetSettings} />
          </GlassSurface>
        ) : null}
      </Section>

      <BottomSheet visible={financialPeriodOpen} title="Ciclo financiero" onClose={() => setFinancialPeriodOpen(false)}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Choose when a new monthly money cycle begins. Day 28, for example, creates cycles from the 28th through the 27th.</Text>
        <Field label="Día de inicio (1–28)" value={financialPeriodDraft} onChangeText={setFinancialPeriodDraft} keyboardType="number-pad" placeholder="1" error={!Number.isInteger(Number(financialPeriodDraft)) || Number(financialPeriodDraft) < 1 || Number(financialPeriodDraft) > 28 ? 'Choose a day from 1 through 28.' : undefined} />
        <Button label="Guardar ciclo financiero" onPress={saveFinancialPeriod} />
      </BottomSheet>

      <BottomSheet visible={appSelectionOpen} title="Aplicaciones de origen" onClose={() => setAppSelectionOpen(false)}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Elige las aplicaciones instaladas cuyas notificaciones puede capturar Brain IA.</Text>
        <Button label={appSelectionSaving ? 'Guardando…' : 'Pausar toda la captura'} disabled={appSelectionLoading || appSelectionSaving} onPress={() => { void saveCaptureSelection(captureApps.map((app) => ({ ...app, selected: false }))); }} variant="secondary" />
        {appSelectionLoading ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Buscando aplicaciones instaladas…</Text> : null}
        {!appSelectionLoading && !captureApps.length ? <StateView title="No se encontraron aplicaciones" description="Actualiza la lista después de instalar una aplicación." actionLabel="Reintentar" onAction={() => { void refreshCaptureApps(); }} /> : null}
        {captureApps.map((app) => <Row key={app.packageName} title={app.name} subtitle={app.packageName} accessory="switch" switchValue={app.selected} onSwitchChange={() => toggleCaptureApp(app.packageName)} />)}
      </BottomSheet>

      <BottomSheet visible={credentialSheetOpen} title={credentialMode === 'rotate' ? 'Rotar credencial v2' : 'Conectar sesión v2'} onClose={() => setCredentialSheetOpen(false)}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Pega la credencial de dispositivo emitida por Brain IA. Se guarda cifrada y no se muestra de nuevo.</Text>
        <Field label="Credencial de dispositivo" value={credentialTokenDraft} onChangeText={setCredentialTokenDraft} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Obligatoria" />
        <Field label="Vencimiento (opcional)" value={credentialExpiryDraft} onChangeText={setCredentialExpiryDraft} autoCapitalize="none" autoCorrect={false} placeholder="2027-01-31T00:00:00Z" />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Acepta ISO-8601 o epoch en milisegundos. Sin vencimiento declarado, la credencial se usa hasta que la revoques o cierres sesión.</Text>
        <Button label={credentialBusy ? 'Guardando…' : credentialMode === 'rotate' ? 'Guardar rotación' : 'Guardar credencial'} onPress={saveCredential} disabled={credentialBusy || credentialTokenDraft.trim().length === 0} />
      </BottomSheet>
    </Screen>
  );
}
