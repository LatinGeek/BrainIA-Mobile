package com.brainia.mobile.notification

import java.security.MessageDigest

/** A notification slot is mutable; each complete observation has an immutable identity. */
internal object NotificationCaptureIdentity {
  fun forObservation(installationId: String, fields: List<String?>): String {
    val digest = MessageDigest.getInstance("SHA-256")
    // Length framing distinguishes null, empty values, and embedded separators.
    (listOf("notification-observation-v2", installationId) + fields).forEach { value ->
      if (value == null) {
        digest.update("-1:".toByteArray(Charsets.UTF_8))
      } else {
        val bytes = value.toByteArray(Charsets.UTF_8)
        digest.update("${bytes.size}:".toByteArray(Charsets.UTF_8))
        digest.update(bytes)
      }
    }
    return "notif:v2:" + digest.digest().joinToString("") { (it.toInt() and 0xff).toString(16).padStart(2, '0') }
  }
}
