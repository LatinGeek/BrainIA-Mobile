package com.brainia.mobile.notification

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

internal object NotificationBridgeDiagnostics {
  private const val TAG = "BrainIANotificationBridge"
  private const val MAX_QUEUED_LOGS = 150
  private const val MAX_UPLOAD_BATCH_SIZE = 50
  private val lock = Any()
  private val flushLock = Any()

  fun record(
    context: Context,
    level: String,
    event: String,
    message: String,
    metadata: JSONObject = JSONObject(),
  ) {
    val installationId = installationId(context)
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
    val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
    val notificationAccessEnabled = NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    val item = JSONObject().apply {
      put("id", "listener_${UUID.randomUUID()}")
      put("platform", "android")
      put("component", "notification_listener")
      put("level", level)
      put("event", event)
      put("message", message.take(500))
      put("occurredAt", isoTimestamp(System.currentTimeMillis()))
      put("metadata", JSONObject(metadata.toString()).apply {
        put("androidApi", Build.VERSION.SDK_INT)
        put("manufacturer", Build.MANUFACTURER.take(80))
        put("model", Build.MODEL.take(80))
        put("installationId", installationId)
        put("notificationAccessEnabled", notificationAccessEnabled)
        put("batteryOptimizationIgnored", powerManager?.isIgnoringBatteryOptimizations(context.packageName) ?: false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          put("backgroundRestricted", activityManager?.isBackgroundRestricted ?: false)
        }
      })
    }
    synchronized(lock) {
      val prefs = prefs(context)
      val queue = readQueue(prefs.getString(NotificationBridgeConfig.KEY_DIAGNOSTIC_LOGS, null))
      queue.put(item)
      while (queue.length() > MAX_QUEUED_LOGS) queue.remove(0)
      prefs.edit().putString(NotificationBridgeConfig.KEY_DIAGNOSTIC_LOGS, queue.toString()).apply()
    }
    when (level) {
      "error" -> Log.e(TAG, "$event: $message")
      "warning" -> Log.w(TAG, "$event: $message")
      else -> Log.i(TAG, "$event: $message")
    }
  }

  fun queuedCount(context: Context): Int = synchronized(lock) {
    readQueue(prefs(context).getString(NotificationBridgeConfig.KEY_DIAGNOSTIC_LOGS, null)).length()
  }

  fun flush(context: Context): Boolean = synchronized(flushLock) {
    val preferences = prefs(context)
    val baseUrl = preferences.getString(NotificationBridgeConfig.KEY_BASE_URL, null).orEmpty().trim().trimEnd('/')
    if (baseUrl.isEmpty()) return@synchronized false
    val snapshot = synchronized(lock) {
      readQueue(preferences.getString(NotificationBridgeConfig.KEY_DIAGNOSTIC_LOGS, null)).let { JSONArray(it.toString()) }
    }
    if (snapshot.length() == 0) return@synchronized true

    for (batchStart in 0 until snapshot.length() step MAX_UPLOAD_BATCH_SIZE) {
      val batch = JSONArray()
      val batchEnd = minOf(batchStart + MAX_UPLOAD_BATCH_SIZE, snapshot.length())
      for (index in batchStart until batchEnd) batch.put(snapshot.getJSONObject(index))

      val connection = URL("$baseUrl/api/v1/client-diagnostics").openConnection() as HttpURLConnection
      try {
        connection.requestMethod = "POST"
        connection.doInput = true
        connection.doOutput = true
        connection.connectTimeout = 10_000
        connection.readTimeout = 10_000
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
        connection.setRequestProperty("Accept", "application/json")
        preferences.getString(NotificationBridgeConfig.KEY_API_KEY, null)?.trim()?.takeIf { it.isNotEmpty() }
          ?.let { connection.setRequestProperty("x-brainia-api-key", it) }
        preferences.getString(NotificationBridgeConfig.KEY_CLIENT_ID, null)?.trim()?.takeIf { it.isNotEmpty() }
          ?.let { connection.setRequestProperty("x-brainia-client-id", it) }
        connection.outputStream.use { output ->
          output.write(JSONObject().put("logs", batch).toString().toByteArray(Charsets.UTF_8))
        }
        val status = connection.responseCode
        if (status !in 200..299) {
          val body = connection.errorStream?.use { stream ->
            BufferedReader(InputStreamReader(stream)).use { reader -> reader.readText().take(240) }
          }
          preferences.edit().putString(NotificationBridgeConfig.KEY_DIAGNOSTIC_LAST_UPLOAD_ERROR, "Server rejected diagnostics ($status): ${body ?: "empty"}").apply()
          return@synchronized false
        }

        connection.inputStream?.close()
        val uploadedIds = buildSet {
          for (index in 0 until batch.length()) add(batch.getJSONObject(index).getString("id"))
        }
        synchronized(lock) {
          val current = readQueue(preferences.getString(NotificationBridgeConfig.KEY_DIAGNOSTIC_LOGS, null))
          val remaining = JSONArray()
          for (index in 0 until current.length()) {
            val item = current.getJSONObject(index)
            if (!uploadedIds.contains(item.optString("id"))) remaining.put(item)
          }
          preferences.edit()
            .putString(NotificationBridgeConfig.KEY_DIAGNOSTIC_LOGS, remaining.toString())
            .putLong(NotificationBridgeConfig.KEY_DIAGNOSTIC_LAST_UPLOADED_AT, System.currentTimeMillis())
            .remove(NotificationBridgeConfig.KEY_DIAGNOSTIC_LAST_UPLOAD_ERROR)
            .apply()
        }
      } catch (error: Exception) {
        preferences.edit().putString(NotificationBridgeConfig.KEY_DIAGNOSTIC_LAST_UPLOAD_ERROR, "${error.javaClass.simpleName}: ${error.message?.take(180) ?: "upload failed"}").apply()
        return@synchronized false
      } finally {
        connection.disconnect()
      }
    }

    true
  }

  private fun prefs(context: Context) = context.getSharedPreferences(NotificationBridgeConfig.PREFS_NAME, Context.MODE_PRIVATE)

  private fun installationId(context: Context): String = synchronized(lock) {
    val preferences = prefs(context)
    preferences.getString(NotificationBridgeConfig.KEY_DIAGNOSTIC_INSTALLATION_ID, null)
      ?.takeIf { it.isNotBlank() }
      ?: UUID.randomUUID().toString().also { generated ->
        preferences.edit().putString(NotificationBridgeConfig.KEY_DIAGNOSTIC_INSTALLATION_ID, generated).apply()
      }
  }

  private fun readQueue(value: String?): JSONArray = try {
    if (value.isNullOrBlank()) JSONArray() else JSONArray(value)
  } catch (_: Exception) {
    JSONArray()
  }

  private fun isoTimestamp(epochMillis: Long): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
  }.format(Date(epochMillis))
}
