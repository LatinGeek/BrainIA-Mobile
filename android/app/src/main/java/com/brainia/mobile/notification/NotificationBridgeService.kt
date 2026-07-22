package com.brainia.mobile.notification

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
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

  override fun onDestroy() {
    reconciliationHandler.removeCallbacks(periodicReconciliation)
    if (connectedListener === this) {
      connectedListener = null
      updateStatus { remove(NotificationBridgeConfig.KEY_LISTENER_CONNECTED_AT) }
    }
    executor.shutdown()
    super.onDestroy()
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    connectedListener = this
    updateStatus { putLong(NotificationBridgeConfig.KEY_LISTENER_CONNECTED_AT, System.currentTimeMillis()) }
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

    executor.execute {
      try {
        sendCapture(sbn, appName, packageName)
      } catch (error: Exception) {
        Log.w(TAG, "Unable to forward notification capture", error)
        updateStatus { putString(NotificationBridgeConfig.KEY_LAST_ERROR, "Unable to forward a notification; it will be retried while active") }
      }
    }
  }

  /** Re-read notifications Android still exposes after an app or listener restart. */
  fun reconcileActiveNotifications(onComplete: ((Boolean) -> Unit)? = null) {
    // getActiveNotifications is a NotificationListenerService API. Run the
    // snapshot on its main thread so a manual check has the same execution
    // context as the periodic reconciliation.
    reconciliationHandler.post {
      val notifications = try {
        getActiveNotifications()?.toList().orEmpty()
      } catch (error: Exception) {
        Log.w(TAG, "Unable to inspect active notifications", error)
        updateStatus { putString(NotificationBridgeConfig.KEY_LAST_ERROR, "Active notifications are not available yet; BrainIA will retry") }
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
            Log.w(TAG, "Unable to reconcile one active notification", error)
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
        completed = true
      } catch (error: Exception) {
        Log.w(TAG, "Unable to reconcile active notifications", error)
        updateStatus { putString(NotificationBridgeConfig.KEY_LAST_ERROR, "Active notifications are not available yet; BrainIA will retry") }
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
    val prefs = applicationContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, MODE_PRIVATE)
    val baseUrl = prefs.getString(NotificationBridgeConfig.KEY_BASE_URL, null).orEmpty().trim()
    if (baseUrl.isEmpty()) {
      Log.w(TAG, "Skipping notification capture because baseUrl is empty")
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
    try {
      connection.requestMethod = "POST"
      connection.doInput = true
      connection.doOutput = true
      connection.connectTimeout = 10_000
      connection.readTimeout = 10_000
      connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
      connection.setRequestProperty("Accept", "application/json")
      prefs.getString(NotificationBridgeConfig.KEY_API_KEY, null)
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
        ?.let { connection.setRequestProperty("x-brainia-api-key", it) }
      prefs.getString(NotificationBridgeConfig.KEY_CLIENT_ID, null)
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
        ?.let { connection.setRequestProperty("x-brainia-client-id", it) }

      connection.outputStream.use { output ->
        output.write(payload.toString().toByteArray(Charsets.UTF_8))
      }

      val status = connection.responseCode
      if (status !in 200..299) {
        val errorBody = connection.errorStream?.use { stream ->
          BufferedReader(InputStreamReader(stream)).use { reader -> reader.readText() }
        }
        Log.w(TAG, "Capture rejected with status=$status body=${errorBody ?: "<empty>"}")
        updateStatus { putString(NotificationBridgeConfig.KEY_LAST_ERROR, "Server rejected capture ($status)") }
        return false
      } else {
        connection.inputStream?.close()
        updateStatus {
          putLong(NotificationBridgeConfig.KEY_LAST_FORWARDED_AT, System.currentTimeMillis())
          remove(NotificationBridgeConfig.KEY_LAST_ERROR)
        }
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

    val selected = applicationContext.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, MODE_PRIVATE)
      .getStringSet(NotificationBridgeConfig.KEY_CAPTURE_APP_PACKAGES, emptySet()) ?: emptySet()
    if (selected.isNotEmpty()) return selected.contains(packageName)

    return normalized.contains("santander") ||
      normalized.contains("mercadopago") ||
      (normalized.contains("mercado") && normalized.contains("pago")) ||
      normalized.contains("google wallet") ||
      normalized.contains("walletnfcrel") ||
      normalized.contains("billetera")
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

    fun isConnected(): Boolean = connectedListener != null

    private fun completePendingReconciliations(completed: Boolean) {
      val callbacks = pendingReconciliationCallbacks.toList()
      pendingReconciliationCallbacks.clear()
      callbacks.forEach { callback -> callback(completed) }
    }
  }
}
