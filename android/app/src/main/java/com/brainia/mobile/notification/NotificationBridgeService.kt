package com.brainia.mobile.notification

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import android.os.Handler
import android.os.Looper
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.concurrent.Executors
import java.util.concurrent.CopyOnWriteArrayList
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class NotificationBridgeService : NotificationListenerService() {
  private val executor = Executors.newSingleThreadExecutor()
  private val reconciliationHandler = Handler(Looper.getMainLooper())
  private val periodicReconciliation = object : Runnable {
    override fun run() {
      reconcileActiveNotifications()
      reconciliationHandler.postDelayed(this, RECONCILIATION_INTERVAL_MILLIS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    NotificationBridgeDiagnostics.record(applicationContext, "info", "service_created", "Android created the notification listener service")
  }

  override fun onDestroy() {
    NotificationBridgeDiagnostics.record(applicationContext, "warning", "service_destroyed", "Android destroyed the notification listener service")
    reconciliationHandler.removeCallbacks(periodicReconciliation)
    if (connectedListener === this) {
      connectedListener = null
      updateStatus {
        remove(NotificationBridgeConfig.KEY_LISTENER_CONNECTED_AT)
        putLong(NotificationBridgeConfig.KEY_LISTENER_DISCONNECTED_AT, System.currentTimeMillis())
      }
    }
    executor.shutdown()
    super.onDestroy()
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    if (connectedListener === this) {
      connectedListener = null
    }
    updateStatus {
      remove(NotificationBridgeConfig.KEY_LISTENER_CONNECTED_AT)
      putLong(NotificationBridgeConfig.KEY_LISTENER_DISCONNECTED_AT, System.currentTimeMillis())
      putString(NotificationBridgeConfig.KEY_LAST_ERROR, LISTENER_RECONNECTING_MESSAGE)
    }
    NotificationBridgeDiagnostics.record(applicationContext, "warning", "listener_disconnected", "Android disconnected the notification listener")
    NotificationReconciliationWorker.scheduleReconnect(applicationContext)
    reconciliationHandler.postDelayed({
      requestListenerReconnect(applicationContext, force = true)
    }, DISCONNECT_REBIND_DELAY_MILLIS)
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    connectedListener = this
    NotificationReconciliationWorker.cancelReconnect(applicationContext)
    updateStatus {
      putLong(NotificationBridgeConfig.KEY_LISTENER_CONNECTED_AT, System.currentTimeMillis())
      remove(NotificationBridgeConfig.KEY_LISTENER_DISCONNECTED_AT)
      remove(NotificationBridgeConfig.KEY_LISTENER_RECONNECT_REQUESTED_AT)
      putInt(NotificationBridgeConfig.KEY_RECONNECT_ATTEMPTS, 0)
      if (isListenerConnectionError(
          applicationContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, MODE_PRIVATE)
            .getString(NotificationBridgeConfig.KEY_LAST_ERROR, null),
        )) {
        remove(NotificationBridgeConfig.KEY_LAST_ERROR)
      }
    }
    NotificationBridgeDiagnostics.record(applicationContext, "info", "listener_connected", "Notification listener connected successfully")
    executor.execute { NotificationBridgeDiagnostics.flush(applicationContext) }
    // Android can report the listener as connected a fraction before its active
    // notification snapshot is available. Let that snapshot settle first.
    reconciliationHandler.postDelayed({
      reconcileActiveNotifications { completed -> completePendingReconciliations(completed) }
    }, INITIAL_RECONCILIATION_DELAY_MILLIS)
    reconciliationHandler.removeCallbacks(periodicReconciliation)
    reconciliationHandler.postDelayed(periodicReconciliation, RECONCILIATION_INTERVAL_MILLIS)
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val packageName = sbn.packageName?.trim().orEmpty()
    if (packageName.isEmpty() || packageName == applicationContext.packageName) {
      return
    }

    val appName = resolveAppName(packageName) ?: packageName
    if (!shouldCapture(packageName, appName)) {
      return
    }

    updateStatus { putLong(NotificationBridgeConfig.KEY_LAST_RECEIVED_AT, System.currentTimeMillis()) }
    NotificationBridgeDiagnostics.record(
      applicationContext,
      "debug",
      "notification_received",
      "A selected application posted a notification",
      JSONObject().put("packageName", packageName),
    )

    executor.execute {
      try {
        sendCapture(sbn, appName, packageName)
      } catch (error: Exception) {
        Log.w(TAG, "Unable to forward notification capture")
        updateStatus { putString(NotificationBridgeConfig.KEY_LAST_ERROR, "Unable to forward a notification; it will be retried while active") }
        NotificationBridgeDiagnostics.record(applicationContext, "error", "capture_exception", "Notification forwarding raised ${error.javaClass.simpleName}")
        NotificationBridgeDiagnostics.flush(applicationContext)
      }
    }
  }

  /** Re-read notifications Android still exposes after an app or listener restart. */
  fun reconcileActiveNotifications(onComplete: ((Boolean) -> Unit)? = null) {
    NotificationBridgeDiagnostics.record(applicationContext, "debug", "reconciliation_started", "Reading Android active notifications")
    // getActiveNotifications is a NotificationListenerService API. Run the
    // snapshot on its main thread so a manual check has the same execution
    // context as the periodic reconciliation.
    reconciliationHandler.post {
      val notifications = try {
        getActiveNotifications()?.toList().orEmpty()
      } catch (error: Exception) {
        Log.w(TAG, "Unable to inspect active notifications")
        updateStatus { putString(NotificationBridgeConfig.KEY_LAST_ERROR, "Active notifications are not available yet; BrainIA will retry") }
        NotificationBridgeDiagnostics.record(applicationContext, "error", "active_notifications_unavailable", "Android active notifications raised ${error.javaClass.simpleName}")
        onComplete?.invoke(false)
        return@post
      }

      executor.execute {
        var completed = false
        try {
        var failedCaptures = 0
        notifications.forEach { sbn ->
          try {
            val packageName = sbn.packageName?.trim().orEmpty()
            if (packageName.isEmpty() || packageName == applicationContext.packageName) return@forEach
            val appName = resolveAppName(packageName) ?: packageName
            if (!shouldCapture(packageName, appName)) return@forEach
            updateStatus { putLong(NotificationBridgeConfig.KEY_LAST_RECEIVED_AT, System.currentTimeMillis()) }
            if (!sendCapture(sbn, appName, packageName)) failedCaptures += 1
          } catch (error: Exception) {
            failedCaptures += 1
            Log.w(TAG, "Unable to reconcile one active notification")
          }
        }
        updateStatus {
          putLong(NotificationBridgeConfig.KEY_LAST_RECONCILED_AT, System.currentTimeMillis())
          if (failedCaptures == 0) {
            remove(NotificationBridgeConfig.KEY_LAST_ERROR)
          } else {
            putString(NotificationBridgeConfig.KEY_LAST_ERROR, "Reconciliation completed; $failedCaptures notification(s) will be retried while active")
          }
        }
        NotificationBridgeDiagnostics.record(
          applicationContext,
          if (failedCaptures == 0) "info" else "warning",
          "reconciliation_completed",
          "Active notification reconciliation completed",
          JSONObject().put("activeCount", notifications.size).put("failedCaptures", failedCaptures),
        )
        NotificationBridgeDiagnostics.flush(applicationContext)
        completed = true
      } catch (error: Exception) {
        Log.w(TAG, "Unable to reconcile active notifications")
        updateStatus { putString(NotificationBridgeConfig.KEY_LAST_ERROR, "Active notifications are not available yet; BrainIA will retry") }
        NotificationBridgeDiagnostics.record(applicationContext, "error", "reconciliation_exception", "Reconciliation raised ${error.javaClass.simpleName}")
      } finally {
        onComplete?.invoke(completed)
      }
      }
    }
  }

  private fun sendCapture(
    sbn: StatusBarNotification,
    appName: String,
    packageName: String,
  ): Boolean {
    if (!shouldCapture(packageName, appName)) return true
    val prefs = applicationContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, MODE_PRIVATE)
    val baseUrl = prefs.getString(NotificationBridgeConfig.KEY_BASE_URL, null).orEmpty().trim()
    if (baseUrl.isEmpty()) {
      Log.w(TAG, "Skipping notification capture because baseUrl is empty")
      NotificationBridgeDiagnostics.record(applicationContext, "error", "capture_configuration_missing", "Notification capture cannot run because the backend URL is missing")
      return false
    }

    val notification = sbn.notification ?: return true
    val extras = notification.extras
    val title = firstNonBlank(
      extras.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
      extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
      appName,
      packageName,
    ) ?: packageName
    val text = firstNonBlank(
      extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)?.toString(),
    )
    val body = listOfNotNull(title.takeIf { it.isNotBlank() }, text?.takeIf { it.isNotBlank() }).distinct().joinToString("\n").ifBlank { title }
    val timestamp = formatTimestamp(sbn.postTime)
    val notificationKey = sbn.key.ifBlank { "${packageName}:${sbn.postTime}" }

    val raw = JSONObject().apply {
      put("packageName", packageName)
      put("appName", appName)
      put("notificationKey", notificationKey)
      put("groupKey", sbn.groupKey ?: JSONObject.NULL)
      put("channelId", notification.channelId ?: JSONObject.NULL)
      put("category", notification.category ?: JSONObject.NULL)
      put("isOngoing", sbn.isOngoing)
      put("isClearable", sbn.isClearable)
      put("postTime", sbn.postTime)
      put("title", extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: JSONObject.NULL)
      put("text", extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: JSONObject.NULL)
      put("bigText", extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: JSONObject.NULL)
      put("subText", extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString() ?: JSONObject.NULL)
      put("summaryText", extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)?.toString() ?: JSONObject.NULL)
    }

    val payload = JSONObject().apply {
      put("id", notificationKey)
      put("contractVersion", 1)
      put("kind", "notification")
      put("appName", appName)
      put("packageName", packageName)
      put("title", title)
      put("body", body)
      put("timestamp", timestamp)
      put("externalId", notificationKey)
      put("idempotencyKey", "notif:$notificationKey")
      put("tags", JSONArray(listOf("notification", notificationTagFor(packageName, appName))))
      put("raw", raw)
    }

    val connection = URL("${trimTrailingSlash(baseUrl)}/api/v1/capture/notification").openConnection() as HttpURLConnection
    NotificationBridgeDiagnostics.record(applicationContext, "debug", "capture_forward_started", "Forwarding a notification capture", JSONObject().put("packageName", packageName))
    try {
      connection.requestMethod = "POST"
      connection.doInput = true
      connection.doOutput = true
      connection.connectTimeout = 10_000
      connection.readTimeout = 10_000
      connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
      connection.setRequestProperty("Accept", "application/json")
      NotificationBridgeConfig.readCredential(applicationContext, NotificationBridgeConfig.KEY_API_KEY)
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
        ?.let { connection.setRequestProperty("x-brainia-api-key", it) }
      NotificationBridgeConfig.readCredential(applicationContext, NotificationBridgeConfig.KEY_CLIENT_ID)
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
        ?.let { connection.setRequestProperty("x-brainia-client-id", it) }

      connection.outputStream.use { output ->
        output.write(payload.toString().toByteArray(Charsets.UTF_8))
      }

      val status = connection.responseCode
      if (status !in 200..299) {
        connection.errorStream?.close()
        Log.w(TAG, "Capture rejected with status=$status")
        updateStatus { putString(NotificationBridgeConfig.KEY_LAST_ERROR, "Server rejected capture ($status)") }
        NotificationBridgeDiagnostics.record(applicationContext, "error", "capture_rejected", "Backend rejected notification capture", JSONObject().put("statusCode", status).put("packageName", packageName))
        return false
      } else {
        connection.inputStream?.close()
        updateStatus {
          putLong(NotificationBridgeConfig.KEY_LAST_FORWARDED_AT, System.currentTimeMillis())
          remove(NotificationBridgeConfig.KEY_LAST_ERROR)
        }
        NotificationBridgeDiagnostics.record(applicationContext, "info", "capture_forwarded", "Notification capture reached the backend", JSONObject().put("statusCode", status).put("packageName", packageName))
        return true
      }
    } finally {
      connection.disconnect()
    }
  }

  private fun shouldCapture(packageName: String, appName: String): Boolean {
    val normalized = "${packageName.lowercase()} ${appName.lowercase()}"
    if (normalized.contains("brainia")) {
      return false
    }

    val prefs = applicationContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, MODE_PRIVATE)
    val consent = NotificationBridgeConfig.readCaptureConsent(prefs)
    return NotificationBridgeConfig.shouldCapture(consent.configured, consent.packages, packageName)
  }

  private fun updateStatus(update: android.content.SharedPreferences.Editor.() -> Unit) {
    applicationContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, MODE_PRIVATE)
      .edit()
      .apply(update)
      .apply()
  }

  private fun resolveAppName(packageName: String): String? {
    return try {
      val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
      packageManager.getApplicationLabel(applicationInfo)?.toString()?.trim()?.takeIf { it.isNotEmpty() }
    } catch (_: Exception) {
      null
    }
  }

  private fun firstNonBlank(vararg values: String?): String? {
    return values.firstOrNull { !it.isNullOrBlank() }?.trim()
  }

  private fun trimTrailingSlash(value: String): String = value.trim().trimEnd('/')

  private fun formatTimestamp(epochMillis: Long): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
      timeZone = TimeZone.getTimeZone("UTC")
    }
    return formatter.format(Date(epochMillis))
  }

  private fun notificationTagFor(packageName: String, appName: String): String {
    val normalized = "${packageName.lowercase()} ${appName.lowercase()}"
    return when {
      normalized.contains("santander") -> "bank"
      normalized.contains("mercadopago") || (normalized.contains("mercado") && normalized.contains("pago")) -> "wallet"
      normalized.contains("google wallet") || normalized.contains("walletnfcrel") -> "wallet"
      else -> "notification"
    }
  }

  companion object {
    private const val TAG = "BrainIANotificationBridge"
    private const val RECONCILIATION_INTERVAL_MILLIS = 30 * 60 * 1000L
    private const val INITIAL_RECONCILIATION_DELAY_MILLIS = 750L
    private const val DISCONNECT_REBIND_DELAY_MILLIS = 1_000L
    private const val REBIND_THROTTLE_MILLIS = 20_000L
    private const val FORCED_REBIND_THROTTLE_MILLIS = 8_000L
    private const val UNBIND_REBIND_DELAY_MILLIS = 750L
    const val LISTENER_RECONNECTING_MESSAGE = "Listener is reconnecting; active notifications could not be checked yet"
    const val LISTENER_ACCESS_RESET_MESSAGE = "Android has not started the listener. Turn notification access off and on once"

    @Volatile
    private var connectedListener: NotificationBridgeService? = null
    private val pendingReconciliationCallbacks = CopyOnWriteArrayList<(Boolean) -> Unit>()

    fun requestReconciliation(onComplete: ((Boolean) -> Unit)? = null): Boolean {
      val listener = connectedListener ?: return false
      listener.reconcileActiveNotifications(onComplete)
      return true
    }

    fun queueReconciliationAfterReconnect(onComplete: (Boolean) -> Unit) {
      pendingReconciliationCallbacks.add(onComplete)
    }

    fun removePendingReconciliation(onComplete: (Boolean) -> Unit) {
      pendingReconciliationCallbacks.remove(onComplete)
    }

    fun isConnected(): Boolean = connectedListener != null

    fun requestListenerReconnect(context: android.content.Context, force: Boolean = false): Boolean {
      if (isConnected()) return true
      if (!NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)) {
        NotificationBridgeDiagnostics.record(context, "warning", "rebind_skipped_access_disabled", "Listener reconnect skipped because notification access is disabled")
        return false
      }
      val now = System.currentTimeMillis()
      val prefs = context.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, android.content.Context.MODE_PRIVATE)
      val previousRequestAt = prefs.getLong(NotificationBridgeConfig.KEY_LISTENER_RECONNECT_REQUESTED_AT, 0)
      val throttle = if (force) FORCED_REBIND_THROTTLE_MILLIS else REBIND_THROTTLE_MILLIS
      // Persist the cooldown across React/native process recreation. A static
      // timestamp resets when Xiaomi or another OEM kills the app process and
      // was the source of repeated requestRebind storms.
      if (now - previousRequestAt < throttle) return true
      val attempts = prefs.getInt(NotificationBridgeConfig.KEY_RECONNECT_ATTEMPTS, 0) + 1
      prefs.edit()
        .remove(NotificationBridgeConfig.KEY_LISTENER_CONNECTED_AT)
        .putLong(NotificationBridgeConfig.KEY_LISTENER_RECONNECT_REQUESTED_AT, now)
        .putInt(NotificationBridgeConfig.KEY_RECONNECT_ATTEMPTS, attempts)
        .apply()
      val disconnectedAt = prefs.getLong(NotificationBridgeConfig.KEY_LISTENER_DISCONNECTED_AT, 0)
      val shouldCycleBinding = force && Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
      val canDirectlyRebind = disconnectedAt > 0
      if (!shouldCycleBinding && !canDirectlyRebind) {
        prefs.edit().putString(NotificationBridgeConfig.KEY_LAST_ERROR, LISTENER_ACCESS_RESET_MESSAGE).apply()
        NotificationBridgeDiagnostics.record(
          context,
          "error",
          "listener_registration_stale",
          "Notification access is enabled but Android has never bound the listener",
          JSONObject().put("attempt", attempts).put("requiresAccessReset", true),
        )
        return false
      }
      NotificationBridgeDiagnostics.record(
        context,
        "warning",
        if (shouldCycleBinding) "rebind_cycle_requested" else "rebind_requested",
        if (shouldCycleBinding) "Cycling Android notification-listener binding" else "Requesting Android notification-listener rebind",
        JSONObject().put("attempt", attempts).put("forced", force).put("bindingCycle", shouldCycleBinding),
      )
      return try {
        val component = android.content.ComponentName(context, NotificationBridgeService::class.java)
        if (shouldCycleBinding) {
          NotificationListenerService.requestUnbind(component)
          Handler(Looper.getMainLooper()).postDelayed({
            try {
              NotificationListenerService.requestRebind(component)
              NotificationBridgeDiagnostics.record(context, "info", "rebind_cycle_dispatched", "Android listener unbind/rebind cycle was dispatched", JSONObject().put("attempt", attempts))
            } catch (error: Exception) {
              Log.w(TAG, "Unable to complete notification-listener binding cycle")
              prefs.edit().putString(NotificationBridgeConfig.KEY_LAST_ERROR, "Android rejected the listener reconnect request").apply()
              NotificationBridgeDiagnostics.record(context, "error", "rebind_cycle_rejected", "Android rejected the delayed listener rebind", JSONObject().put("attempt", attempts).put("errorType", error.javaClass.simpleName))
            }
          }, UNBIND_REBIND_DELAY_MILLIS)
        } else {
          NotificationListenerService.requestRebind(component)
        }
        true
      } catch (error: Exception) {
        Log.w(TAG, "Unable to request notification-listener rebind")
        prefs.edit().putString(NotificationBridgeConfig.KEY_LAST_ERROR, "Android rejected the listener reconnect request").apply()
        NotificationBridgeDiagnostics.record(context, "error", "rebind_rejected", "Android rejected notification-listener rebind", JSONObject().put("attempt", attempts).put("errorType", error.javaClass.simpleName))
        false
      }
    }

    fun isListenerConnectionError(error: String?): Boolean = error == LISTENER_RECONNECTING_MESSAGE ||
      error == LISTENER_ACCESS_RESET_MESSAGE ||
      error == "Android rejected the listener reconnect request" ||
      error == "Listener disconnected; BrainIA is reconnecting"

    private fun completePendingReconciliations(completed: Boolean) {
      val callbacks = pendingReconciliationCallbacks.toList()
      pendingReconciliationCallbacks.clear()
      callbacks.forEach { callback -> callback(completed) }
    }
  }
}
