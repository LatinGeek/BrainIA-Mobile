package com.brainia.mobile.notification

internal object NotificationBridgeConfig {
  const val PREFS_NAME = "brainia_notification_bridge"
  const val KEY_BASE_URL = "baseUrl"
  const val KEY_API_KEY = "apiKey"
  const val KEY_CLIENT_ID = "clientId"
  const val KEY_LISTENER_CONNECTED_AT = "listenerConnectedAt"
  const val KEY_LISTENER_DISCONNECTED_AT = "listenerDisconnectedAt"
  const val KEY_LISTENER_RECONNECT_REQUESTED_AT = "listenerReconnectRequestedAt"
  const val KEY_LAST_RECEIVED_AT = "lastReceivedAt"
  const val KEY_LAST_FORWARDED_AT = "lastForwardedAt"
  const val KEY_LAST_RECONCILED_AT = "lastReconciledAt"
  const val KEY_LAST_ERROR = "lastError"
  const val KEY_CAPTURE_APP_PACKAGES = "captureAppPackages"
  const val KEY_DIAGNOSTIC_LOGS = "diagnosticLogs"
  const val KEY_DIAGNOSTIC_LAST_UPLOADED_AT = "diagnosticLastUploadedAt"
  const val KEY_DIAGNOSTIC_LAST_UPLOAD_ERROR = "diagnosticLastUploadError"
  const val KEY_DIAGNOSTIC_INSTALLATION_ID = "diagnosticInstallationId"
  const val KEY_RECONNECT_ATTEMPTS = "reconnectAttempts"
}
