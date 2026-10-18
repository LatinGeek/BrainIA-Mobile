package com.brainia.mobile.notification

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test
import java.io.File
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.AEADBadTagException

class NotificationBridgeSecurityTest {
  // Synthetic keys exist only in this JVM fixture; no device or signing keys.
  private fun fixture() = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()

  @Test fun expoAesGcmEnvelopeRoundTripsUtf8() {
    val key = fixture()
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key) }
    val ciphertext = cipher.doFinal("fixture-sesión-安全".toByteArray(Charsets.UTF_8))
    assertEquals("fixture-sesión-安全", NotificationBridgeConfig.decryptCredential(ciphertext, cipher.iv, 128, key))
  }

  @Test(expected = AEADBadTagException::class)
  fun tamperedCiphertextNeverFallsBackToPlaintext() {
    val key = fixture()
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key) }
    val ciphertext = cipher.doFinal("synthetic-session".toByteArray())
    ciphertext[0] = (ciphertext[0].toInt() xor 1).toByte()
    NotificationBridgeConfig.decryptCredential(ciphertext, cipher.iv, 128, key)
  }

  @Test(expected = AEADBadTagException::class)
  fun wrongKeyFailsClosed() {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, fixture()) }
    NotificationBridgeConfig.decryptCredential(cipher.doFinal("synthetic-session".toByteArray()), cipher.iv, 128, fixture())
  }

  @Test(expected = IllegalArgumentException::class)
  fun shortAuthenticationTagsAreRejected() {
    NotificationBridgeConfig.decryptCredential(ByteArray(16), ByteArray(12), 64, fixture())
  }

  @Test fun nativeReaderUsesTheJsSecureStoreKeys() {
    assertEquals("brainia_mobile.apiKey", NotificationBridgeConfig.credentialStorageKey("apiKey"))
    assertEquals("brainia_mobile.clientId", NotificationBridgeConfig.credentialStorageKey("clientId"))
  }

  @Test(expected = IllegalArgumentException::class)
  fun credentialReaderRejectsUnrelatedKeys() {
    NotificationBridgeConfig.credentialStorageKey("baseUrl")
  }

  @Test fun unconfiguredDoesNotCaptureFinanceApps() {
    listOf("com.santander.app", "com.mercadopago.wallet", "com.google.android.apps.walletnfcrel").forEach {
      assertFalse(NotificationBridgeConfig.shouldCapture(false, emptySet(), it))
    }
  }

  @Test fun explicitEmptyDoesNotCaptureFinanceApps() {
    listOf("com.santander.app", "com.mercadopago.wallet", "com.google.android.apps.walletnfcrel").forEach {
      assertFalse(NotificationBridgeConfig.shouldCapture(true, emptySet(), it))
    }
  }

  @Test fun selectionRequiresConfiguration() {
    assertFalse(NotificationBridgeConfig.shouldCapture(false, setOf("com.example.bank"), "com.example.bank"))
  }

  @Test fun onlyExactSelectedPackageIsAllowed() {
    val selected = setOf("com.example.bank")
    assertTrue(NotificationBridgeConfig.shouldCapture(true, selected, "com.example.bank"))
    assertFalse(NotificationBridgeConfig.shouldCapture(true, selected, "com.example.bank.fake"))
    assertFalse(NotificationBridgeConfig.shouldCapture(true, selected, "com.santander.app"))
  }

  @Test fun deselectingLastApplicationStopsCapture() {
    val selection = mutableSetOf("com.example.bank")
    assertTrue(NotificationBridgeConfig.shouldCapture(true, selection, "com.example.bank"))
    selection.clear()
    assertFalse(NotificationBridgeConfig.shouldCapture(true, selection, "com.example.bank"))
  }

  // --- v2 consent record: unconfigured vs explicit empty vs selected ---

  @Test fun unconfiguredIsDistinctFromExplicitEmpty() {
    val unconfigured = NotificationBridgeConfig.resolveCaptureConsent(false, false, null)
    assertEquals(NotificationBridgeConfig.CaptureConsent.UNCONFIGURED, unconfigured.status())
    assertFalse(unconfigured.configured)
    assertFalse("nothing to persist before the user chooses", unconfigured.requiresPersist)

    val explicitEmpty = NotificationBridgeConfig.resolveCaptureConsent(false, true, emptySet())
    assertEquals(NotificationBridgeConfig.CaptureConsent.EMPTY, explicitEmpty.status())
    assertTrue(explicitEmpty.configured)
    assertTrue("legacy empty selection must gain a versioned record", explicitEmpty.requiresPersist)

    val persistedEmpty = NotificationBridgeConfig.resolveCaptureConsent(true, true, emptySet())
    assertEquals(NotificationBridgeConfig.CaptureConsent.EMPTY, persistedEmpty.status())
    assertFalse(persistedEmpty.requiresPersist)
  }

  @Test fun legacySelectionMigratesWithoutLosingPackages() {
    val migrated = NotificationBridgeConfig.resolveCaptureConsent(false, true, setOf("com.example.bank", "com.example.wallet"))
    assertEquals(NotificationBridgeConfig.CaptureConsent.SELECTED, migrated.status())
    assertEquals(setOf("com.example.bank", "com.example.wallet"), migrated.packages)
    assertEquals(NotificationBridgeConfig.CAPTURE_CONSENT_VERSION, migrated.version)
    assertTrue(migrated.requiresPersist)
  }

  @Test fun legacyEmptySelectionMigratesAsPaused() {
    val migrated = NotificationBridgeConfig.resolveCaptureConsent(false, true, null)
    assertEquals(NotificationBridgeConfig.CaptureConsent.EMPTY, migrated.status())
    assertTrue(migrated.configured)
    assertTrue(migrated.packages.isEmpty())
    assertTrue(migrated.requiresPersist)
  }

  @Test fun versionedConsentRecordIsNotRewritten() {
    val current = NotificationBridgeConfig.resolveCaptureConsent(true, true, setOf("com.example.bank"))
    assertEquals(NotificationBridgeConfig.CAPTURE_CONSENT_VERSION, current.version)
    assertFalse(current.requiresPersist)
  }

  @Test fun blankLegacyPackagesAreDropped() {
    val migrated = NotificationBridgeConfig.resolveCaptureConsent(false, true, setOf(" com.example.bank ", "", "   "))
    assertEquals(setOf("com.example.bank"), migrated.packages)
    assertEquals(NotificationBridgeConfig.CaptureConsent.SELECTED, migrated.status())
  }

  // --- diagnostics hygiene ---

  @Test fun diagnosticSanitizerRedactsCredentialShapes() {
    val raw = "Authorization: Bearer abc.def.123 apiKey=super-secret token: xyz x-brainia-client-id=client-7"
    val clean = NotificationBridgeConfig.sanitizeDiagnostic(raw)
    assertTrue(clean.contains("[redacted]"))
    assertFalse(clean.contains("abc.def.123"))
    assertFalse(clean.contains("super-secret"))
    assertFalse(clean.contains("client-7"))
  }

  @Test fun diagnosticSanitizerKeepsHumanMessages() {
    assertEquals(
      "Listener is reconnecting; active notifications could not be checked yet",
      NotificationBridgeConfig.sanitizeDiagnostic("Listener is reconnecting; active notifications could not be checked yet"),
    )
  }

  // --- rotation of the Keystore encryption key ---

  @Test fun rotatingTheKeyInvalidatesThePreviousEnvelope() {
    val oldKey = fixture()
    val newKey = fixture()
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, oldKey) }
    val ciphertext = cipher.doFinal("synthetic-session".toByteArray())
    try {
      NotificationBridgeConfig.decryptCredential(ciphertext, cipher.iv, 128, newKey)
      fail("a rotated key must not decrypt the previous envelope")
    } catch (_: AEADBadTagException) {
      // expected: rotation invalidates old ciphertext instead of downgrading
    }
  }

  // --- backup and release-signing provenance (static file assertions) ---

  @Test fun backupRulesExcludeEveryCredentialStore() {
    val module = moduleDir()
    val manifest = File(module, "src/main/AndroidManifest.xml").readText()
    assertTrue("backup must stay disabled", manifest.contains("android:allowBackup=\"false\""))
    assertTrue(manifest.contains("@xml/brainia_backup_rules"))
    assertTrue(manifest.contains("@xml/brainia_data_extraction_rules"))
    listOf("brainia_backup_rules.xml", "brainia_data_extraction_rules.xml").forEach { name ->
      val xml = File(module, "src/main/res/xml/$name").readText()
      assertTrue("$name must exclude sharedpref", xml.contains("<exclude domain=\"sharedpref\" path=\".\" />"))
      assertTrue("$name must exclude device_sharedpref", xml.contains("<exclude domain=\"device_sharedpref\" path=\".\" />"))
      assertTrue("$name must exclude files", xml.contains("<exclude domain=\"file\" path=\".\" />"))
      assertTrue("$name must exclude databases", xml.contains("<exclude domain=\"database\" path=\".\" />"))
    }
  }

  @Test fun projectGradlePropertiesHaveNoReleaseSigningValues() {
    val androidDir = moduleDir().parentFile
    val properties = File(androidDir, "gradle.properties")
    assertTrue("android/gradle.properties must exist", properties.isFile)
    properties.readLines().forEach { line ->
      assertFalse(
        "Plaintext release signing values must not live in the project tree",
        line.trim().startsWith("BRAINIA_RELEASE_"),
      )
    }
  }

  private fun moduleDir(): File {
    val workingDir = System.getProperty("user.dir") ?: "."
    val candidates = listOf(
      File(workingDir),
      File(workingDir, "app"),
      File("").absoluteFile,
      File("").absoluteFile.resolve("app"),
    )
    return candidates.firstOrNull { File(it, "src/main/AndroidManifest.xml").isFile }
      ?: throw IllegalStateException("Cannot locate the android app module from $workingDir")
  }
}
