package com.brainia.mobile.notification

import android.content.Context
import android.content.ComponentName
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.content.pm.ApplicationInfo
import android.provider.Settings
import android.service.notification.NotificationListenerService
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
  fun configure(baseUrl: String?, apiKey: String?, clientId: String?) {
    val prefs = reactContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .putString(NotificationBridgeConfig.KEY_BASE_URL, baseUrl?.trim().orEmpty())
      .putString(NotificationBridgeConfig.KEY_API_KEY, apiKey?.trim().orEmpty())
      .putString(NotificationBridgeConfig.KEY_CLIENT_ID, clientId?.trim().orEmpty())
      .apply()
    clearLegacyReconciliationError(prefs)
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
    val status = Arguments.createMap().apply {
      putBoolean("accessEnabled", NotificationManagerCompat.getEnabledListenerPackages(reactContext).contains(reactContext.packageName))
      putBoolean("listenerReady", NotificationBridgeService.isConnected())
      putDouble("connectedAt", prefs.getLong(NotificationBridgeConfig.KEY_LISTENER_CONNECTED_AT, 0).toDouble())
      putDouble("lastReceivedAt", prefs.getLong(NotificationBridgeConfig.KEY_LAST_RECEIVED_AT, 0).toDouble())
      putDouble("lastForwardedAt", prefs.getLong(NotificationBridgeConfig.KEY_LAST_FORWARDED_AT, 0).toDouble())
      putDouble("lastReconciledAt", prefs.getLong(NotificationBridgeConfig.KEY_LAST_RECONCILED_AT, 0).toDouble())
      putString("lastError", prefs.getString(NotificationBridgeConfig.KEY_LAST_ERROR, null))
    }
    promise.resolve(status)
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

    NotificationBridgeService.queueReconciliationAfterReconnect(resolve)
    try {
      NotificationListenerService.requestRebind(
        ComponentName(reactContext, NotificationBridgeService::class.java),
      )
    } catch (_: Exception) {
      resolve(false)
      return
    }

    // Android normally invokes onListenerConnected immediately after rebind.
    // Do not leave the React promise (and its button) pending forever if the
    // system declines or delays that request.
    Handler(Looper.getMainLooper()).postDelayed({
      if (settled.compareAndSet(false, true)) {
        reactContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, Context.MODE_PRIVATE)
          .edit().putString(NotificationBridgeConfig.KEY_LAST_ERROR, "Listener is reconnecting; active notifications could not be checked yet").apply()
        reactContext.runOnJSQueueThread { promise.resolve(false) }
      }
    }, RECONCILIATION_RECONNECT_TIMEOUT_MILLIS)
  }

  @ReactMethod
  fun getInstalledCaptureApps(promise: Promise) {
    val prefs = reactContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, Context.MODE_PRIVATE)
    val selected = prefs.getStringSet(NotificationBridgeConfig.KEY_CAPTURE_APP_PACKAGES, emptySet()) ?: emptySet()
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
  fun setCaptureAppPackages(packages: ReadableArray) {
    val values = buildSet { for (index in 0 until packages.size()) packages.getString(index)?.trim()?.takeIf { it.isNotEmpty() }?.let(::add) }
    reactContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, Context.MODE_PRIVATE)
      .edit().putStringSet(NotificationBridgeConfig.KEY_CAPTURE_APP_PACKAGES, values).apply()
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
    const val RECONCILIATION_RECONNECT_TIMEOUT_MILLIS = 8_000L
  }
}
