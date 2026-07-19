package com.brainia.mobile.notification

import android.content.Context
import android.content.Intent
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
  }

  @ReactMethod
  fun isNotificationListenerEnabled(promise: Promise) {
    val enabled = NotificationManagerCompat.getEnabledListenerPackages(reactContext).contains(reactContext.packageName)
    promise.resolve(enabled)
  }

  @ReactMethod
  fun getNotificationListenerStatus(promise: Promise) {
    val prefs = reactContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, Context.MODE_PRIVATE)
    val status = Arguments.createMap().apply {
      putBoolean("accessEnabled", NotificationManagerCompat.getEnabledListenerPackages(reactContext).contains(reactContext.packageName))
      putDouble("connectedAt", prefs.getLong(NotificationBridgeConfig.KEY_LISTENER_CONNECTED_AT, 0).toDouble())
      putDouble("lastReceivedAt", prefs.getLong(NotificationBridgeConfig.KEY_LAST_RECEIVED_AT, 0).toDouble())
      putDouble("lastForwardedAt", prefs.getLong(NotificationBridgeConfig.KEY_LAST_FORWARDED_AT, 0).toDouble())
      putString("lastError", prefs.getString(NotificationBridgeConfig.KEY_LAST_ERROR, null))
    }
    promise.resolve(status)
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
}
