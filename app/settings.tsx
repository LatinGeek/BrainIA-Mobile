import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Platform, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { Button, Field, SegmentedControl, Tag } from '@/components/controls';
import { IconTile, Row } from '@/components/data/Row';
import { StateView } from '@/components/data/StateView';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { Screen, Section } from '@/components/layout/Screen';
import { useToast } from '@/components/layout/Toast';
import { useAppState, useBrainIAClient, useTheme } from '@/lib/app-state';
import { clearAllJsonCache } from '@/lib/cache';
import { clearDiagnostics, readDiagnostics } from '@/lib/diagnostics';
import { AppSettings } from '@/lib/domain';
import { UYU_PER_USD } from '@/lib/format';
import { useAsyncResource, useReduceMotion } from '@/lib/hooks';
import { listLayout } from '@/lib/motion';
import { allowCredentialRecovery, enrollV2AccessToken, logoutV2Session, readV2Credential, revokeV2AccessToken, rotateV2AccessToken, type V2CredentialSnapshot } from '@/lib/storage';
import { flushNotificationBridgeDiagnostics, getInstalledCaptureApps, getNotificationBridgeStatus, openNotificationBridgeSettings, reconcileActiveNotifications, setCaptureAppPackages } from '@/lib/notification-bridge';

const dashboardModes = [
  { value: 'balanced', label: 'Equilibrado' },
  { value: 'knowledge', label: 'Conocimiento' },
  { value: 'finance', label: 'Dinero' },
] as const;

const visibilityModes = [
  { value: 'essential', label: 'Esencial' },
  { value: 'balanced', label: 'Equilibrado' },
  { value: 'detailed', label: 'Detallado' },
] as const;

export default function SettingsScreen() {
  const theme = useTheme();
  const toast = useToast();
  const reduceMotion = useReduceMotion();
  const [maintenance, setMaintenance] = useState<string | null>(null);
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
  const expiryRef = useRef<TextInput>(null);
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
  // Connection fields hold a draft only while they are being edited, and commit on blur:
  // every committed change rebuilds the API client and triggers a health check, so typing
  // must not commit. A null draft shows the saved value.
  const [baseUrlDraft, setBaseUrlDraft] = useState<string | null>(null);
  const [clientIdDraft, setClientIdDraft] = useState<string | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState<string | null>(null);
  const dayValid = /^\d{1,2}$/.test(financialPeriodDraft) && +financialPeriodDraft >= 1 && +financialPeriodDraft <= 28;

  const runMaintenance = async (name: string, action: () => unknown | Promise<unknown>, message: string) => {
    if (maintenance) return;
    setMaintenance(name);
    try {
      await action();
      toast.show(message, { tone: 'positive' });
    } catch {
      toast.show('No se pudo completar la acción. Intenta de nuevo.', { tone: 'danger' });
    } finally {
      setMaintenance(null);
    }
  };

  const openFinancialPeriod = () => {
    setFinancialPeriodDraft(String(settings.financialPeriodStartDay));
    setFinancialPeriodOpen(true);
  };

  const saveFinancialPeriod = () => {
    const day = Number(financialPeriodDraft);
    if (!dayValid) return;
    setFinancialPeriodStartDay(day);
    setFinancialPeriodOpen(false);
    toast.show('Ciclo financiero guardado', { tone: 'positive' });
  };

  const healthLoader = useMemo(() => () => client.health(), [client]);
  const { data, loading, error, refresh, reload: reloadHealth } = useAsyncResource(healthLoader, [healthLoader]);
  const diagnosticsLoader = useMemo(() => () => readDiagnostics(), []);
  const { data: diagnostics, reload: refreshDiagnostics } = useAsyncResource(diagnosticsLoader, [diagnosticsLoader]);
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
    } catch {
      toast.show('No se pudieron cargar las aplicaciones. Intenta de nuevo.', { tone: 'danger' });
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
      toast.show('Diagnóstico enviado', { tone: 'positive' });
    } catch {
      toast.show('No se pudo enviar el diagnóstico.', { tone: 'danger' });
    } finally {
      setSendingListenerDiagnostics(false);
    }
  };
  const refreshNotificationBridgeStatus = async () => {
    setCheckingActiveNotifications(true);
    try {
      await reconcileActiveNotifications();
      await Promise.all([refreshCaptureApps(), refreshNotificationBridge()]);
      toast.show('Notificaciones comprobadas', { tone: 'positive' });
    } catch {
      toast.show('No se pudieron comprobar las notificaciones.', { tone: 'danger' });
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
    const previous = captureApps;
    setCaptureApps(next);
    setAppSelectionSaving(true);
    try {
      await setCaptureAppPackages(next.filter((app) => app.selected).map((app) => app.packageName));
      refreshNotificationBridge();
    } catch {
      setCaptureApps(previous);
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
  const closeCredentialSheet = () => {
    if (credentialBusy) return;
    setCredentialTokenDraft('');
    setCredentialExpiryDraft('');
    setCredentialSheetOpen(false);
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
      toast.show('Sesión segura guardada', { tone: 'positive' });
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
    refresh();
    await refreshDiagnostics();
  };
  const confirmClearLocalData = () => {
    Alert.alert('¿Vaciar la caché?', 'Se borrarán los datos guardados en este dispositivo. Se volverán a descargar al abrir cada pantalla.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Vaciar', style: 'destructive', onPress: () => { void runMaintenance('cache', clearLocalData, 'Caché vaciada'); } },
    ]);
  };
  const confirmResetSettings = () => {
    Alert.alert('¿Restablecer los ajustes?', 'Se restablecerán la conexión y las preferencias locales a sus valores predeterminados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Restablecer', style: 'destructive', onPress: () => { void runMaintenance('reset', resetSettings, 'Ajustes restablecidos'); } },
    ]);
  };

  const credentialStatus = credentialState?.status ?? 'unconfigured';
  const credentialSummary = credentialStatus === 'active'
    ? `Sesión activa (generación ${credentialState?.generation ?? 1}).${credentialState?.expiresAt ? ` Vence ${new Date(credentialState.expiresAt).toLocaleDateString('es-UY')}.` : ' Sin vencimiento declarado.'}`
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
      back backLabel="Volver"
      title="Ajustes"
      overline="Preferencias"
      subtitle="Personaliza tu experiencia y administra tus fuentes."
      actions={<Tag label={loading ? 'Comprobando' : data?.ok ? 'Conectado' : 'Sin conexión'} tone={loading ? 'neutral' : data?.ok ? 'positive' : 'warning'} live={loading} />}
    >
      <Section title="General" subtitle="La interfaz está en español. La evidencia conserva su idioma original.">
        <GlassSurface level="thin" padding="sm" contentStyle={{ gap: theme.spacing.sm }}>
        <Row style={{ borderRadius: 0 }} title="Idioma de la aplicación" descriptionLines={4} subtitle="Español" description="Brain IA comprende información en español e inglés." leading={<IconTile icon="globe" />} accessory="none" />
        <View style={{ paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm }}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Detalle de las fuentes</Text>
        <SegmentedControl role="radio" accessibilityLabel="Detalle de las fuentes" items={visibilityModes as unknown as typeof visibilityModes} value={settings.dataVisibility} onChange={(value) => setDataVisibility(value as AppSettings['dataVisibility'])} />
        </View>
        </GlassSurface>
      </Section>

      <Section title="Dinero" subtitle="Configura tu ciclo mensual y la presencia de Dinero en la vista de Hoy.">
        <GlassSurface level="thin" padding="sm" contentStyle={{ gap: theme.spacing.sm }}>
        <Row style={{ borderRadius: 0 }} title={`${UYU_PER_USD.toFixed(4)} UYU/USD`} descriptionLines={4} subtitle="Tipo de cambio de referencia" description="Los totales convertidos son estimaciones. Cada transacción conserva siempre su moneda original." leading={<IconTile icon="repeat" color={theme.colors.model} />} accessory="none" />
        <Row style={{ borderRadius: 0 }} title={`Día ${settings.financialPeriodStartDay} de cada mes`} descriptionLines={4} subtitle="Inicio del ciclo financiero" description="Los informes mensuales van desde este día hasta el día anterior al próximo ciclo." leading={<IconTile icon="calendar" color={theme.colors.accent} />} trailing={<Text style={[theme.typography.bodyStrong, { color: theme.colors.accentStrong }]}>Cambiar</Text>} accessory="none" onPress={openFinancialPeriod} />
        <View style={{ paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm }}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Prioridad en Hoy</Text>
        <SegmentedControl role="radio" accessibilityLabel="Prioridad en Hoy" items={dashboardModes as unknown as typeof dashboardModes} value={settings.dashboardMode} onChange={(value) => setDashboardMode(value as AppSettings['dashboardMode'])} />
        </View>
        </GlassSurface>
      </Section>

      <Section title="Notificaciones" subtitle="Recibe recordatorios para lecturas y decisiones útiles.">
        <GlassSurface level="thin" padding="sm">
        <Row style={{ borderRadius: 0 }} title="Recordatorios de resúmenes" descriptionLines={4} subtitle="Un aviso periódico cuando haya un nuevo resumen útil." leading={<IconTile icon="book-open" />} accessory="switch" switchValue={settings.digestNotifications} onSwitchChange={setDigestNotifications} />
        <Row style={{ borderRadius: 0 }} title="Recordatorios de revisión" descriptionLines={4} subtitle="Un recordatorio cuando un nombre o una categoría necesiten una decisión." leading={<IconTile icon="shield" color={theme.status.review} />} accessory="switch" switchValue={settings.reviewNotifications} onSwitchChange={setReviewNotifications} />
        </GlassSurface>
      </Section>

      {Platform.OS === 'android' ? (
        <Section title="Captura de notificaciones" subtitle="Lee notificaciones de apps seleccionadas y las envía a Brain IA.">
          <GlassSurface level="thin" padding="md" contentStyle={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconTile icon="bell" color={listenerConnected ? theme.colors.accent : theme.status.warning} />
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Acceso a notificaciones</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {notificationBridgeInitialLoading ? 'Comprobando el acceso a notificaciones…' : listenerConnected ? (lastForwardedAt ? `Escucha conectada. Último envío: ${new Date(lastForwardedAt).toLocaleString('es-UY')}` : 'Escucha conectada y lista.') : notificationBridgeStatus?.accessEnabled ? (listenerNeedsAttention ? 'Acceso activado; la escucha se está reconectando.' : 'Acceso activado. Conectando el servicio de escucha.') : 'El acceso a notificaciones está desactivado.'}
                </Text>
              </View>
              <Tag label={notificationBridgeInitialLoading ? 'Comprobando' : listenerConnected ? 'Activo' : listenerNeedsAttention ? 'Requiere atención' : notificationBridgeStatus?.accessEnabled ? 'Reconectando' : 'Desactivado'} tone={listenerConnected ? 'positive' : 'warning'} />
            </View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{notificationBridgeStatus?.captureConsent === 'unconfigured' ? 'Elige qué aplicaciones pueden compartir notificaciones.' : notificationBridgeStatus?.captureConsent === 'empty' ? 'Captura pausada: no seleccionaste ninguna aplicación.' : 'Solo se capturan notificaciones de las aplicaciones que seleccionaste.'}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{lastReceivedAt ? `Última notificación leída: ${new Date(lastReceivedAt).toLocaleString('es-UY')}` : 'Todavía no se leyó ninguna notificación compatible.'}</Text>
            {lastReconciledAt ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Notificaciones activas comprobadas por última vez: {new Date(lastReconciledAt).toLocaleString('es-UY')}</Text> : null}
            {notificationBridgeStatus?.lastError ? <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: theme.status.warning }]}>No se pudo conectar con el servicio de notificaciones. Comprueba el acceso e intenta de nuevo.</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              <Button label="Elegir aplicaciones" variant="secondary" size="sm" onPress={openAppSelection} />
              <Button label="Abrir acceso" size="sm" onPress={() => { void openNotificationBridgeSettings(); }} />
              <Button label="Comprobar activas" loading={checkingActiveNotifications} variant="secondary" size="sm" onPress={() => { void refreshNotificationBridgeStatus(); }} disabled={checkingActiveNotifications} />
              <Button label="Enviar diagnóstico" loading={sendingListenerDiagnostics} variant="secondary" size="sm" onPress={() => { void sendListenerDiagnostics(); }} disabled={sendingListenerDiagnostics} />
            </View>
          </GlassSurface>
        </Section>
      ) : null}

      <Animated.View layout={reduceMotion ? undefined : listLayout}>
      <Section title="Avanzado" subtitle="Conexión, credenciales y mantenimiento.">
        <GlassSurface level="thin" padding="sm">
        <Row style={{ borderRadius: 0 }} title="Herramientas avanzadas" subtitle={advancedOpen ? 'Ocultar conexión y diagnóstico.' : 'Mostrar conexión y diagnóstico.'} leading={<IconTile icon="tool" />} accessory="expand" expanded={advancedOpen} onPress={() => setAdvancedOpen((value) => !value)} />
        </GlassSurface>
        {advancedOpen ? (
          <Animated.View entering={reduceMotion ? FadeIn.duration(theme.motion.duration.reduced).reduceMotion(ReduceMotion.Never) : FadeInDown.duration(theme.motion.duration.quick).easing(Easing.bezier(...theme.motion.easing.out))} exiting={FadeOut.duration(reduceMotion ? theme.motion.duration.reduced : theme.motion.duration.press).reduceMotion(ReduceMotion.Never)} layout={reduceMotion ? undefined : listLayout} style={{ gap: theme.spacing.sm }}>
          <GlassSurface title="Conexión" level="thin" padding="md" contentStyle={{ gap: theme.spacing.md }}>
            <Field label="URL base" value={baseUrlDraft ?? settings.baseUrl} onChangeText={setBaseUrlDraft} onEndEditing={() => { if (baseUrlDraft !== null && baseUrlDraft.trim() !== settings.baseUrl) setBaseUrl(baseUrlDraft.trim()); setBaseUrlDraft(null); }} keyboardType="url" returnKeyType="done" autoCapitalize="none" autoCorrect={false} />
            <Field label="ID de cliente" value={clientIdDraft ?? settings.clientId} onChangeText={(value) => { allowCredentialRecovery('clientId'); setClientIdDraft(value); }} onEndEditing={() => { if (clientIdDraft !== null && clientIdDraft.trim() !== settings.clientId) setClientId(clientIdDraft.trim()); setClientIdDraft(null); }} autoCapitalize="none" autoCorrect={false} placeholder="opcional" />
            <Field label="Clave de API" value={apiKeyDraft ?? settings.apiKey} onChangeText={(value) => { allowCredentialRecovery('apiKey'); setApiKeyDraft(value); }} onEndEditing={() => { if (apiKeyDraft !== null && apiKeyDraft !== settings.apiKey) setApiKey(apiKeyDraft); setApiKeyDraft(null); }} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="opcional" />
            <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{loading ? 'Comprobando conexión…' : error ? 'No se pudo conectar con el servicio.' : data?.ok ? 'Servicio disponible.' : 'El servicio no responde en este momento.'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              <Button label="Comprobar servicio" loading={loading} disabled={loading || maintenance !== null} variant="secondary" size="sm" onPress={() => { void runMaintenance('health', async () => { const result = await reloadHealth(); if (!result.ok) throw new Error('unavailable'); }, 'Servicio disponible'); }} />
              <Button label="Recuperar valores" loading={maintenance === 'settings'} disabled={maintenance !== null} variant="ghost" size="sm" onPress={() => { void runMaintenance('settings', refreshSettings, 'Valores recuperados'); }} />
            </View>
          </GlassSurface>
          <GlassSurface title="Sesión de datos v2" level="thin" padding="md" contentStyle={{ gap: theme.spacing.md }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{credentialSummary}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {credentialNeedsRotation ? <Button label={credentialStatus === 'active' ? 'Rotar credencial' : 'Volver a conectar'} size="sm" onPress={() => openCredentialSheet(credentialStatus === 'active' ? 'rotate' : 'enroll')} /> : <Button label="Conectar sesión v2" size="sm" onPress={() => openCredentialSheet('enroll')} />}
              {credentialStatus === 'active' || credentialStatus === 'expired' ? <Button label="Revocar" variant="secondary" size="sm" onPress={confirmRevokeCredential} disabled={credentialBusy} /> : null}
              {credentialStatus !== 'unconfigured' ? <Button label="Cerrar sesión" variant="ghost" size="sm" onPress={confirmLogout} disabled={credentialBusy} /> : null}
            </View>
          </GlassSurface>
          <GlassSurface title="Diagnóstico" level="thin" padding="md" contentStyle={{ gap: theme.spacing.md }}>
            {diagnostics?.[0] ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{diagnostics[0].label} · {new Date(diagnostics[0].timestamp).toLocaleString('es-UY')}</Text> : <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>No hay diagnósticos registrados.</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              <Button label="Actualizar diagnóstico" variant="secondary" size="sm" loading={maintenance === 'diagnostics'} disabled={maintenance !== null} onPress={() => { void runMaintenance('diagnostics', refreshDiagnostics, 'Diagnóstico actualizado'); }} />
              <Button label="Vaciar caché" variant="secondary" size="sm" loading={maintenance === 'cache'} disabled={maintenance !== null} onPress={confirmClearLocalData} />
            </View>
          </GlassSurface>
          <GlassSurface title="Restablecer preferencias locales" level="thin" padding="md" contentStyle={{ gap: theme.spacing.md }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Esto restablece la apariencia y la conexión predeterminadas de la aplicación.</Text>
              <Button label="Restablecer ajustes" variant="danger" size="sm" loading={maintenance === 'reset'} disabled={maintenance !== null} onPress={confirmResetSettings} />
          </GlassSurface>
          </Animated.View>
        ) : null}
      </Section>
      </Animated.View>

      <BottomSheet visible={financialPeriodOpen} title="Ciclo financiero" onClose={() => setFinancialPeriodOpen(false)} footer={<Button label="Guardar ciclo financiero" onPress={saveFinancialPeriod} disabled={!dayValid} full />}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Elige cuándo empieza un nuevo ciclo mensual de dinero. El día 28, por ejemplo, crea ciclos del 28 al 27 del mes siguiente.</Text>
        <Field label="Día de inicio (1–28)" value={financialPeriodDraft} onChangeText={setFinancialPeriodDraft} keyboardType="number-pad" returnKeyType="done" onSubmitEditing={saveFinancialPeriod} placeholder="1" error={financialPeriodDraft && !dayValid ? 'Elige un día del 1 al 28.' : undefined} />
      </BottomSheet>

      <BottomSheet visible={appSelectionOpen} title="Aplicaciones de origen" onClose={() => setAppSelectionOpen(false)}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Elige las aplicaciones instaladas cuyas notificaciones puede capturar Brain IA.</Text>
        <Button label="Pausar toda la captura" loading={appSelectionSaving} disabled={appSelectionLoading || appSelectionSaving} onPress={() => { void saveCaptureSelection(captureApps.map((app) => ({ ...app, selected: false }))); }} variant="secondary" />
        {appSelectionLoading ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Buscando aplicaciones instaladas…</Text> : null}
        {!appSelectionLoading && !captureApps.length ? <StateView title="No se encontraron aplicaciones" description="Actualiza la lista después de instalar una aplicación." actionLabel="Reintentar" onAction={() => { void refreshCaptureApps(); }} /> : null}
        {captureApps.map((app) => <Row style={{ borderRadius: 0 }} key={app.packageName} title={app.name} subtitle={app.packageName} accessory="switch" disabled={appSelectionSaving} switchValue={app.selected} onSwitchChange={() => toggleCaptureApp(app.packageName)} />)}
      </BottomSheet>

      <BottomSheet visible={credentialSheetOpen} title={credentialMode === 'rotate' ? 'Rotar credencial v2' : 'Conectar sesión v2'} onClose={closeCredentialSheet} footer={<Button label={credentialMode === 'rotate' ? 'Guardar rotación' : 'Guardar credencial'} onPress={saveCredential} loading={credentialBusy} disabled={credentialBusy || credentialTokenDraft.trim().length === 0} full />}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Pega la credencial de dispositivo emitida por Brain IA. Se guarda cifrada y no se muestra de nuevo.</Text>
        <Field label="Credencial de dispositivo" value={credentialTokenDraft} onChangeText={setCredentialTokenDraft} autoFocus returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => expiryRef.current?.focus()} editable={!credentialBusy} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Obligatoria" />
        <Field inputRef={expiryRef} label="Vencimiento (opcional)" value={credentialExpiryDraft} onChangeText={setCredentialExpiryDraft} returnKeyType="done" onSubmitEditing={saveCredential} editable={!credentialBusy} autoCapitalize="none" autoCorrect={false} placeholder="2027-01-31T00:00:00Z" />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Acepta ISO-8601 o epoch en milisegundos. Sin vencimiento declarado, la credencial se usa hasta que la revoques o cierres sesión.</Text>
      </BottomSheet>
    </Screen>
  );
}
