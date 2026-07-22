package com.brainia.mobile.notification

import android.content.ComponentName
import android.content.Context
import android.service.notification.NotificationListenerService
import androidx.work.Worker
import androidx.work.WorkerParameters

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
    if (!NotificationBridgeService.requestReconciliation()) {
      NotificationListenerService.requestRebind(
        ComponentName(applicationContext, NotificationBridgeService::class.java),
      )
    }
    return Result.success()
  }
}
