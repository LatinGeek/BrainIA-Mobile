import { NativeModules, Platform } from 'react-native';

type NotificationBridgeNativeModule = {
  configure: (baseUrl: string) => void;
  isNotificationListenerEnabled: () => Promise<boolean>;
  openNotificationListenerSettings: () => void;
  getNotificationListenerStatus: () => Promise<NotificationBridgeStatus>;
  reconcileActiveNotifications: () => Promise<boolean>;
  getInstalledCaptureApps: () => Promise<NotificationCaptureApp[]>;
  setCaptureAppPackages: (packages: string[]) => Promise<boolean>;
  flushDiagnosticLogs: () => Promise<boolean>;
};

export type NotificationCaptureApp = { packageName: string; name: string; selected: boolean };

export type NotificationBridgeStatus = {
  captureConsent?: 'unconfigured' | 'empty' | 'selected';
  /** Version of the persisted consent record; 0/undefined means pre-migration. */
  captureConsentVersion?: number;
  accessEnabled: boolean;
  listenerReady: boolean;
  connectedAt: number;
  lastReceivedAt: number;
  lastForwardedAt: number;
  lastReconciledAt: number;
  reconnectRequestedAt: number;
  lastError?: string | null;
  reconnectAttempts: number;
  queuedDiagnosticCount: number;
  diagnosticsLastUploadedAt: number;
  diagnosticsLastUploadError?: string | null;
};

const nativeModule = NativeModules.BrainIANotificationBridge as NotificationBridgeNativeModule | undefined;

export async function syncNotificationBridgeConfig(config: {
  baseUrl: string;
  /**
   * @deprecated Accepted only for existing callers; the value is ignored.
   * Native capture reads the Keystore-backed SecureStore envelope directly, so
   * no credential is copied into SharedPreferences or sent through this bridge.
   */
  apiKey?: string;
  /** @deprecated Accepted only for existing callers; the value is ignored. */
  clientId?: string;
}) {
  if (Platform.OS !== 'android' || !nativeModule?.configure) {
    return;
  }

  nativeModule.configure(config.baseUrl?.trim() ?? '');
}

export async function isNotificationBridgeEnabled() {
  if (Platform.OS !== 'android' || !nativeModule?.isNotificationListenerEnabled) {
    return false;
  }

  return nativeModule.isNotificationListenerEnabled();
}

export async function getNotificationBridgeStatus(): Promise<NotificationBridgeStatus> {
  if (Platform.OS !== 'android' || !nativeModule?.getNotificationListenerStatus) {
    return { accessEnabled: false, listenerReady: false, connectedAt: 0, lastReceivedAt: 0, lastForwardedAt: 0, lastReconciledAt: 0, reconnectRequestedAt: 0, reconnectAttempts: 0, queuedDiagnosticCount: 0, diagnosticsLastUploadedAt: 0 };
  }

  return nativeModule.getNotificationListenerStatus();
}

export async function reconcileActiveNotifications(): Promise<boolean> {
  if (Platform.OS === 'android' && nativeModule?.reconcileActiveNotifications) {
    return nativeModule.reconcileActiveNotifications();
  }
  return false;
}

export async function openNotificationBridgeSettings() {
  if (Platform.OS !== 'android' || !nativeModule?.openNotificationListenerSettings) {
    return;
  }

  nativeModule.openNotificationListenerSettings();
}

export async function getInstalledCaptureApps(): Promise<NotificationCaptureApp[]> {
  if (Platform.OS !== 'android' || !nativeModule?.getInstalledCaptureApps) return [];
  return nativeModule.getInstalledCaptureApps();
}

export async function setCaptureAppPackages(packages: string[]) {
  if (Platform.OS === 'android' && nativeModule?.setCaptureAppPackages) await nativeModule.setCaptureAppPackages(packages);
}

export async function flushNotificationBridgeDiagnostics() {
  if (Platform.OS !== 'android' || !nativeModule?.flushDiagnosticLogs) return false;
  return nativeModule.flushDiagnosticLogs();
}
