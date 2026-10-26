package com.brainia.mobile.notification

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationCaptureIdentityTest {
  private val observation = listOf("slot-42", "App", "example.app", "Pedido", "Preparando café ☕", "2026-10-25T12:00:00Z", "notification", "raw snapshot")

  @Test fun reconciliationAndRestartKeepTheSameIdentity() {
    assertEquals(NotificationCaptureIdentity.forObservation("device-a", observation), NotificationCaptureIdentity.forObservation("device-a", observation.toList()))
    assertTrue(NotificationCaptureIdentity.forObservation("device-a", observation).matches(Regex("notif:v2:[0-9a-f]{64}")))
  }

  @Test fun everyChangedSnapshotFieldGetsANewIdentityIncludingSameTimeUpdates() {
    val original = NotificationCaptureIdentity.forObservation("device-a", observation)
    observation.indices.forEach { index ->
      val revised = observation.toMutableList().apply { this[index] = this[index] + " changed" }
      assertNotEquals(original, NotificationCaptureIdentity.forObservation("device-a", revised))
    }
    assertNotEquals(original, NotificationCaptureIdentity.forObservation("device-b", observation))
  }

  @Test fun fieldBoundariesAndUtf8AreUnambiguous() {
    assertNotEquals(NotificationCaptureIdentity.forObservation("a", listOf("a:b", "c")), NotificationCaptureIdentity.forObservation("a", listOf("a", "b:c")))
    assertNotEquals(NotificationCaptureIdentity.forObservation("a", listOf(null)), NotificationCaptureIdentity.forObservation("a", listOf("")))
    assertNotEquals(NotificationCaptureIdentity.forObservation("a", listOf("café")), NotificationCaptureIdentity.forObservation("a", listOf("cafe")))
  }
}
