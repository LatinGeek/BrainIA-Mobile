package com.brainia.mobile.notification

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.content.pm.ApplicationInfo
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.ReadableArray
import java.util.concurrent.atomic.AtomicBoolean

class NotificationBridgeModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "BrainIANotificationBridge"

  @ReactMethod
  fun configure(baseUrl: String?) {
    val prefs = reactContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .putString(NotificationBridgeConfig.KEY_BASE_URL, baseUrl?.trim().orEmpty())
      .remove(NotificationBridgeConfig.KEY_DIAGNOSTIC_LAST_UPLOAD_ERROR)
      .apply()
    clearLegacyReconciliationError(prefs)
    NotificationBridgeDiagnostics.record(reactContext, "info", "configuration_updated", "Notification bridge configuration was refreshed")
    Thread { NotificationBridgeDiagnostics.flush(reactContext) }.start()
    NotificationReconciliationWorker.ensurePeriodicHealthCheck(reactContext)
    if (NotificationManagerCompat.getEnabledListenerPackages(reactContext).contains(reactContext.packageName) &&
      !NotificationBridgeService.isConnected()
    ) {
      NotificationBridgeService.requestListenerReconnect(reactContext, force = true)
      NotificationReconciliationWorker.scheduleReconnect(reactContext)
    }
  }

  @ReactMethod
  fun getCredentialMigrationState(key: String, promise: Promise) {
    if (key != NotificationBridgeConfig.KEY_API_KEY && key != NotificationBridgeConfig.KEY_CLIENT_ID) {
      promise.reject("INVALID_CREDENTIAL", "Unsupported credential")
      return
    }
    val secure = reactContext.getSharedPreferences("SecureStore", Context.MODE_PRIVATE)
    val legacy = reactContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, Context.MODE_PRIVATE)
    promise.resolve(Arguments.createMap().apply {
      putString("legacyValue", legacy.getString(key, null))
      putBoolean("hadSecureValue", secure.contains("key_v1-brainia_mobile.$key") || secure.contains("brainia_mobile.$key"))
    })
  }

  @ReactMethod
  fun clearLegacyCredential(key: String, expectedValue: String, promise: Promise) {
    try {
      check(NotificationBridgeConfig.readCredential(reactContext, key) == expectedValue)
      val removed = reactContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, Context.MODE_PRIVATE)
        .edit().remove(key).commit()
      check(removed)
      promise.resolve(true)
    } catch (_: Exception) {
      promise.reject("CREDENTIAL_MIGRATION_FAILED", "Could not verify secure credential storage; please sign in again")
    }
  }

  @ReactMethod
  fun isNotificationListenerEnabled(promise: Promise) {
    val enabled = NotificationManagerCompat.getEnabledListenerPackages(reactContext).contains(reactContext.packageName)
    promise.resolve(enabled)
  }

  @ReactMethod
  fun getNotificationListenerStatus(promise: Promise) {
    val prefs = reactContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, Context.MODE_PRIVATE)
    clearLegacyReconciliationError(prefs)
    val accessEnabled = NotificationManagerCompat.getEnabledListenerPackages(reactContext).contains(reactContext.packageName)
    if (accessEnabled && !NotificationBridgeService.isConnected()) {
      NotificationBridgeService.requestListenerReconnect(reactContext)
      NotificationReconciliationWorker.scheduleReconnect(reactContext)
    }
    val status = Arguments.createMap().apply {
      putBoolean("accessEnabled", accessEnabled)
      putBoolean("listenerReady", NotificationBridgeService.isConnected())
      val consent = NotificationBridgeConfig.readCaptureConsent(prefs)
      putString("captureConsent", consent.status().name.lowercase())
      putInt("captureConsentVersion", consent.version)
      putDouble("connectedAt", prefs.getLong(NotificationBridgeConfig.KEY_LISTENER_CONNECTED_AT, 0).toDouble())
      putDouble("lastReceivedAt", prefs.getLong(NotificationBridgeConfig.KEY_LAST_RECEIVED_AT, 0).toDouble())
      putDouble("lastForwardedAt", prefs.getLong(NotificationBridgeConfig.KEY_LAST_FORWARDED_AT, 0).toDouble())
      putDouble("lastReconciledAt", prefs.getLong(NotificationBridgeConfig.KEY_LAST_RECONCILED_AT, 0).toDouble())
      putDouble("reconnectRequestedAt", prefs.getLong(NotificationBridgeConfig.KEY_LISTENER_RECONNECT_REQUESTED_AT, 0).toDouble())
      putString("lastError", prefs.getString(NotificationBridgeConfig.KEY_LAST_ERROR, null)?.let(NotificationBridgeConfig::sanitizeDiagnostic))
      putInt("reconnectAttempts", prefs.getInt(NotificationBridgeConfig.KEY_RECONNECT_ATTEMPTS, 0))
      putInt("queuedDiagnosticCount", NotificationBridgeDiagnostics.queuedCount(reactContext))
      putDouble("diagnosticsLastUploadedAt", prefs.getLong(NotificationBridgeConfig.KEY_DIAGNOSTIC_LAST_UPLOADED_AT, 0).toDouble())
      putString("diagnosticsLastUploadError", prefs.getString(NotificationBridgeConfig.KEY_DIAGNOSTIC_LAST_UPLOAD_ERROR, null)?.let(NotificationBridgeConfig::sanitizeDiagnostic))
    }
    promise.resolve(status)
  }

  @ReactMethod
  fun flushDiagnosticLogs(promise: Promise) {
    Thread {
      val uploaded = NotificationBridgeDiagnostics.flush(reactContext)
      reactContext.runOnJSQueueThread { promise.resolve(uploaded) }
    }.start()
  }

  @ReactMethod
  fun reconcileActiveNotifications(promise: Promise) {
    val settled = AtomicBoolean(false)
    val resolve: (Boolean) -> Unit = resolve@{ completed ->
      if (!settled.compareAndSet(false, true)) return@resolve
      reactContext.runOnJSQueueThread {
        promise.resolve(completed)
      }
    }
    val connected = NotificationBridgeService.requestReconciliation(resolve)
    if (connected) return

    if (!NotificationManagerCompat.getEnabledListenerPackages(reactContext).contains(reactContext.packageName)) {
      resolve(false)
      return
    }

    NotificationBridgeService.queueReconciliationAfterReconnect(resolve)
    listOf(0L, 2_500L, 5_000L, 7_500L).forEach { delay ->
      Handler(Looper.getMainLooper()).postDelayed({
        if (!settled.get() && !NotificationBridgeService.isConnected()) {
          val requested = NotificationBridgeService.requestListenerReconnect(reactContext, force = true)
          if (!requested) {
            NotificationBridgeService.removePendingReconciliation(resolve)
            resolve(false)
          }
        }
      }, delay)
    }

    // Android normally invokes onListenerConnected immediately after rebind.
    // Do not leave the React promise (and its button) pending forever if the
    // system declines or delays that request.
    Handler(Looper.getMainLooper()).postDelayed({
      if (settled.compareAndSet(false, true)) {
        NotificationBridgeService.removePendingReconciliation(resolve)
        reactContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, Context.MODE_PRIVATE)
          .edit().putString(NotificationBridgeConfig.KEY_LAST_ERROR, NotificationBridgeService.LISTENER_RECONNECTING_MESSAGE).apply()
        reactContext.runOnJSQueueThread { promise.resolve(false) }
      }
    }, RECONCILIATION_RECONNECT_TIMEOUT_MILLIS)
  }

  @ReactMethod
  fun getInstalledCaptureApps(promise: Promise) {
    val prefs = reactContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, Context.MODE_PRIVATE)
    val selected = NotificationBridgeConfig.readCaptureConsent(prefs).packages
    val apps: WritableArray = Arguments.createArray()
    reactContext.packageManager.getInstalledApplications(0)
      .filter { app ->
        app.packageName != reactContext.packageName &&
          reactContext.packageManager.getLaunchIntentForPackage(app.packageName) != null &&
          app.flags and ApplicationInfo.FLAG_SYSTEM == 0
      }
      .sortedBy { app -> reactContext.packageManager.getApplicationLabel(app).toString() }
      .forEach { app ->
        apps.pushMap(Arguments.createMap().apply {
          putString("packageName", app.packageName)
          putString("name", reactContext.packageManager.getApplicationLabel(app).toString())
          putBoolean("selected", selected.contains(app.packageName))
        })
      }
    promise.resolve(apps)
  }

  @ReactMethod
  fun setCaptureAppPackages(packages: ReadableArray, promise: Promise) {
    val values = buildSet { for (index in 0 until packages.size()) packages.getString(index)?.trim()?.takeIf { it.isNotEmpty() }?.let(::add) }
    val prefs = reactContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, Context.MODE_PRIVATE)
    // An empty set is persisted explicitly: it means "paused", never "unconfigured".
    val saved = NotificationBridgeConfig.writeCaptureConsent(prefs, values)
    if (saved) promise.resolve(true) else promise.reject("CONSENT_SAVE_FAILED", "Could not save your app selection")
  }

  @ReactMethod
  fun openNotificationListenerSettings() {
    try {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
    } catch (_: Exception) {
      val fallbackIntent = Intent(Settings.ACTION_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(fallbackIntent)
    }
  }

  private fun clearLegacyReconciliationError(prefs: android.content.SharedPreferences) {
    if (prefs.getString(NotificationBridgeConfig.KEY_LAST_ERROR, null) == "Unable to reconcile active notifications") {
      prefs.edit().remove(NotificationBridgeConfig.KEY_LAST_ERROR).apply()
    }
  }

  private companion object {
    const val RECONCILIATION_RECONNECT_TIMEOUT_MILLIS = 10_000L
  }
}
