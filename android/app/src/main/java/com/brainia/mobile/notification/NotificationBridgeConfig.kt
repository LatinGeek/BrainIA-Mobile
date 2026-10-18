package com.brainia.mobile.notification

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal object NotificationBridgeConfig {
  const val PREFS_NAME = "brainia_notification_bridge"
  const val KEY_BASE_URL = "baseUrl"
  const val KEY_API_KEY = "apiKey"
  const val KEY_CLIENT_ID = "clientId"
  const val KEY_LISTENER_CONNECTED_AT = "listenerConnectedAt"
  const val KEY_LISTENER_DISCONNECTED_AT = "listenerDisconnectedAt"
  const val KEY_LISTENER_RECONNECT_REQUESTED_AT = "listenerReconnectRequestedAt"
  const val KEY_LAST_RECEIVED_AT = "lastReceivedAt"
  const val KEY_LAST_FORWARDED_AT = "lastForwardedAt"
  const val KEY_LAST_RECONCILED_AT = "lastReconciledAt"
  const val KEY_LAST_ERROR = "lastError"
  const val KEY_CAPTURE_APP_PACKAGES = "captureAppPackages"
  const val KEY_CAPTURE_CONSENT_STATE = "captureConsentState"
  const val KEY_CAPTURE_CONSENT_VERSION = "captureConsentVersion"
  const val KEY_DIAGNOSTIC_LOGS = "diagnosticLogs"
  const val KEY_DIAGNOSTIC_LAST_UPLOADED_AT = "diagnosticLastUploadedAt"
  const val KEY_DIAGNOSTIC_LAST_UPLOAD_ERROR = "diagnosticLastUploadError"
  const val KEY_DIAGNOSTIC_INSTALLATION_ID = "diagnosticInstallationId"
  const val KEY_RECONNECT_ATTEMPTS = "reconnectAttempts"

  const val CAPTURE_CONSENT_VERSION = 2
  const val CONSENT_STATE_CONFIGURED = "configured"

  enum class CaptureConsent { UNCONFIGURED, EMPTY, SELECTED }

  /**
   * Versioned consent snapshot. `configured=false` means the user has never
   * made a choice; `configured=true` with an empty set is an explicit "pause
   * everything" and must stay distinguishable from "not configured yet".
   */
  data class CaptureConsentSelection(
    val configured: Boolean,
    val packages: Set<String>,
    val version: Int,
    val requiresPersist: Boolean,
  ) {
    fun status(): CaptureConsent = when {
      !configured -> CaptureConsent.UNCONFIGURED
      packages.isEmpty() -> CaptureConsent.EMPTY
      else -> CaptureConsent.SELECTED
    }
  }

  // The single credential store is Expo SecureStore (expo-secure-store 57).
  // Read its AES/GCM envelope using the same non-exportable AndroidKeystore key.
  // Do not create keys or delete unreadable entries here: JS offers recovery.
  fun readCredential(context: Context, key: String): String? {
    val storageKey = credentialStorageKey(key)
    val prefs = context.getSharedPreferences("SecureStore", Context.MODE_PRIVATE)
    val envelope = prefs.getString("key_v1-$storageKey", null)
      ?: prefs.getString(storageKey, null) ?: return null
    val item = JSONObject(envelope)
    require(item.getString("scheme") == "aes" && !item.optBoolean("requireAuthentication", false))
    val alias = "AES/GCM/NoPadding:key_v1" +
      if (item.optBoolean("usesKeystoreSuffix", false)) ":keystoreUnauthenticated" else ""
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val entry = store.getEntry(alias, null) as? KeyStore.SecretKeyEntry
      ?: error("Credential key unavailable")
    return decryptCredential(Base64.decode(item.getString("ct"), Base64.DEFAULT),
      Base64.decode(item.getString("iv"), Base64.DEFAULT), item.getInt("tlen"), entry.secretKey)
  }

  fun decryptCredential(ciphertext: ByteArray, iv: ByteArray, tagLength: Int, key: SecretKey): String {
    require(tagLength >= 96)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(tagLength, iv))
    return String(cipher.doFinal(ciphertext), Charsets.UTF_8)
  }

  fun credentialStorageKey(key: String): String {
    require(key == KEY_API_KEY || key == KEY_CLIENT_ID)
    return "brainia_mobile.$key"
  }

  /**
   * Pure resolution of legacy and v2 consent records.
   *
   * Legacy installs wrote only `captureAppPackages` (possibly an empty set),
   * so the key's presence already meant "configured". v2 adds an explicit
   * `captureConsentState`/version record. Either key means configured; neither
   * means the user has not chosen yet. `requiresPersist` is true only for the
   * legacy shape, so the caller can commit the versioned record on upgrade.
   */
  fun resolveCaptureConsent(
    hasConsentState: Boolean,
    hasSelection: Boolean,
    packages: Set<String>?,
  ): CaptureConsentSelection {
    val configured = hasConsentState || hasSelection
    val normalized = packages.orEmpty().map { it.trim() }.filter { it.isNotEmpty() }.toSet()
    return CaptureConsentSelection(
      configured = configured,
      packages = normalized,
      version = CAPTURE_CONSENT_VERSION,
      requiresPersist = configured && !hasConsentState,
    )
  }

  /** Reads (and, on upgrade, commits) the versioned consent record. */
  fun readCaptureConsent(prefs: SharedPreferences): CaptureConsentSelection {
    val selection = resolveCaptureConsent(
      hasConsentState = prefs.contains(KEY_CAPTURE_CONSENT_STATE),
      hasSelection = prefs.contains(KEY_CAPTURE_APP_PACKAGES),
      packages = prefs.getStringSet(KEY_CAPTURE_APP_PACKAGES, null),
    )
    if (selection.requiresPersist) writeCaptureConsent(prefs, selection.packages)
    return selection
  }

  /** Persists an explicit selection; an empty set is a deliberate pause. */
  fun writeCaptureConsent(prefs: SharedPreferences, packages: Set<String>): Boolean =
    prefs.edit()
      .putString(KEY_CAPTURE_CONSENT_STATE, CONSENT_STATE_CONFIGURED)
      .putInt(KEY_CAPTURE_CONSENT_VERSION, CAPTURE_CONSENT_VERSION)
      .putStringSet(KEY_CAPTURE_APP_PACKAGES, packages.map { it.trim() }.filter { it.isNotEmpty() }.toSet())
      .commit()

  private val DIAGNOSTIC_SECRET_PATTERNS = listOf(
    Regex("(?i)(bearer\\s+)[A-Za-z0-9._~+/=-]+"),
    Regex("(?i)((?:api[-_]?key|access[-_]?token|token|secret|password)\\s*[=:]\\s*)[^\\s,;]+"),
    Regex("(?i)(x-brainia-(?:api-key|client-id)\\s*[=:]\\s*)[^\\s,;]+"),
  )

  /** Defence in depth: no credential-shaped text may reach logs or diagnostics. */
  fun sanitizeDiagnostic(value: String): String {
    var sanitized = value
    for (pattern in DIAGNOSTIC_SECRET_PATTERNS) {
      sanitized = pattern.replace(sanitized, "$1[redacted]")
    }
    return sanitized.take(500)
  }

  fun shouldCapture(configured: Boolean, selected: Set<String>, packageName: String): Boolean =
    configured && selected.contains(packageName)
}
