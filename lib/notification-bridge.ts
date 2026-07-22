import { NativeModules, Platform } from 'react-native';

type NotificationBridgeNativeModule = {
  configure: (baseUrl: string, apiKey?: string | null, clientId?: string | null) => void;
  isNotificationListenerEnabled: () => Promise<boolean>;
  openNotificationListenerSettings: () => void;
  getNotificationListenerStatus: () => Promise<NotificationBridgeStatus>;
  reconcileActiveNotifications: () => Promise<boolean>;
  getInstalledCaptureApps: () => Promise<NotificationCaptureApp[]>;
  setCaptureAppPackages: (packages: string[]) => void;
};

export type NotificationCaptureApp = { packageName: string; name: string; selected: boolean };

export type NotificationBridgeStatus = {
  accessEnabled: boolean;
  listenerReady: boolean;
  connectedAt: number;
  lastReceivedAt: number;
  lastForwardedAt: number;
  lastReconciledAt: number;
  lastError?: string | null;
};

const nativeModule = NativeModules.BrainIANotificationBridge as NotificationBridgeNativeModule | undefined;

export async function syncNotificationBridgeConfig(config: {
  baseUrl: string;
  apiKey?: string;
  clientId?: string;
}) {
  if (Platform.OS !== 'android' || !nativeModule?.configure) {
    return;
  }

  nativeModule.configure(config.baseUrl?.trim() ?? '', config.apiKey?.trim() ?? '', config.clientId?.trim() ?? '');
}

export async function isNotificationBridgeEnabled() {
  if (Platform.OS !== 'android' || !nativeModule?.isNotificationListenerEnabled) {
    return false;
  }

  return nativeModule.isNotificationListenerEnabled();
}

export async function getNotificationBridgeStatus(): Promise<NotificationBridgeStatus> {
  if (Platform.OS !== 'android' || !nativeModule?.getNotificationListenerStatus) {
    return { accessEnabled: false, listenerReady: false, connectedAt: 0, lastReceivedAt: 0, lastForwardedAt: 0, lastReconciledAt: 0 };
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

export function setCaptureAppPackages(packages: string[]) {
  if (Platform.OS === 'android' && nativeModule?.setCaptureAppPackages) nativeModule.setCaptureAppPackages(packages);
}
