package com.brainia.mobile.notification

import android.content.Context
import androidx.core.app.NotificationManagerCompat
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Wakes the notification listener every 30 minutes. If it is already connected,
 * it immediately reconciles Android's currently active notifications. Otherwise
 * Android reconnects it and the service reconciles on connection.
 */
class NotificationReconciliationWorker(
  appContext: Context,
  workerParams: WorkerParameters,
) : Worker(appContext, workerParams) {
  override fun doWork(): Result {
    NotificationBridgeDiagnostics.record(applicationContext, "debug", "reconnect_worker_started", "Background listener health check started", org.json.JSONObject().put("runAttempt", runAttemptCount))
    if (NotificationBridgeService.requestReconciliation()) {
      NotificationBridgeDiagnostics.flush(applicationContext)
      return Result.success()
    }
    if (!NotificationManagerCompat.getEnabledListenerPackages(applicationContext).contains(applicationContext.packageName)) {
      NotificationBridgeDiagnostics.record(applicationContext, "warning", "listener_access_disabled", "Notification access is not enabled")
      NotificationBridgeDiagnostics.flush(applicationContext)
      return Result.success()
    }
    NotificationBridgeService.requestListenerReconnect(applicationContext, force = true)
    NotificationBridgeDiagnostics.flush(applicationContext)
    // A periodic health check owns future recovery. Finishing this one-shot
    // worker avoids parallel exponential retry chains on OEM Android builds.
    return Result.success()
  }

  companion object {
    private const val LEGACY_RECONNECT_WORK_NAME = "brainia-notification-listener-reconnect"
    private const val RECONNECT_WORK_NAME = "brainia-notification-listener-reconnect-v2"
    private const val HEALTH_WORK_NAME = "brainia-notification-listener-health-v2"

    fun ensurePeriodicHealthCheck(context: Context) {
      val manager = WorkManager.getInstance(context)
      // Stop retry chains created by older app versions before installing the
      // single-attempt + periodic recovery strategy.
      manager.cancelUniqueWork(LEGACY_RECONNECT_WORK_NAME)
      val request = PeriodicWorkRequestBuilder<NotificationReconciliationWorker>(15, TimeUnit.MINUTES)
        .setInitialDelay(15, TimeUnit.MINUTES)
        .build()
      manager.enqueueUniquePeriodicWork(HEALTH_WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun scheduleReconnect(context: Context) {
      ensurePeriodicHealthCheck(context)
      val request = OneTimeWorkRequestBuilder<NotificationReconciliationWorker>()
        .build()
      WorkManager.getInstance(context).enqueueUniqueWork(RECONNECT_WORK_NAME, ExistingWorkPolicy.KEEP, request)
    }

    fun cancelReconnect(context: Context) {
      val manager = WorkManager.getInstance(context)
      manager.cancelUniqueWork(LEGACY_RECONNECT_WORK_NAME)
      manager.cancelUniqueWork(RECONNECT_WORK_NAME)
    }
  }
}
