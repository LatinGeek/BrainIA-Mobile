package com.brainia.mobile.voice

import android.content.Intent
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

class VoiceNoteModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var recognizer: SpeechRecognizer? = null

  override fun getName() = "BrainIAVoiceNote"

  private fun emitTranscript(text: String, final: Boolean) {
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("BrainIAVoiceTranscript", Arguments.createMap().apply {
        putString("text", text)
        putBoolean("final", final)
      })
  }

  private fun emitState(state: String, message: String? = null) {
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("BrainIAVoiceState", Arguments.createMap().apply {
        putString("state", state)
        if (message != null) putString("message", message)
      })
  }

  private fun finishRecognizer() {
    recognizer?.destroy()
    recognizer = null
  }

  private fun recognitionErrorMessage(error: Int) = when (error) {
    SpeechRecognizer.ERROR_AUDIO -> "The microphone could not capture audio."
    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is required."
    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Speech recognition needs a network connection."
    SpeechRecognizer.ERROR_NO_MATCH -> "No clear speech was detected. Try again and speak closer to the microphone."
    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech recognition is busy. Wait a moment and try again."
    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech was detected. Hold the button while speaking."
    SpeechRecognizer.ERROR_SERVER -> "The speech recognition service is temporarily unavailable."
    else -> "Voice transcription failed. Please try again."
  }

  @ReactMethod
  fun start(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
          val message = "Speech recognition is unavailable on this device."
          emitState("error", message)
          promise.reject("unavailable", message)
          return@runOnUiThread
        }

        finishRecognizer()
        emitState("starting")
        val nextRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
        recognizer = nextRecognizer
        nextRecognizer.setRecognitionListener(object : android.speech.RecognitionListener {
          override fun onReadyForSpeech(params: android.os.Bundle?) { emitState("listening") }
          override fun onBeginningOfSpeech() { emitState("listening") }
          override fun onRmsChanged(rmsdB: Float) {}
          override fun onBufferReceived(buffer: ByteArray?) {}
          override fun onEndOfSpeech() { emitState("transcribing") }
          override fun onPartialResults(results: android.os.Bundle?) {
            results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
              ?.firstOrNull()
              ?.trim()
              ?.takeIf { it.isNotEmpty() }
              ?.let { emitTranscript(it, false) }
          }
          override fun onResults(results: android.os.Bundle?) {
            val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
              ?.firstOrNull()
              ?.trim()
            if (text.isNullOrEmpty()) {
              emitState("error", "No clear speech was detected. Try again.")
            } else {
              emitTranscript(text, true)
              emitState("idle")
            }
            finishRecognizer()
          }
          override fun onError(error: Int) {
            emitState("error", recognitionErrorMessage(error))
            finishRecognizer()
          }
          override fun onEvent(eventType: Int, params: android.os.Bundle?) {}
        })

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
          .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          .putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
          .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        nextRecognizer.startListening(intent)
        promise.resolve(true)
      } catch (error: Exception) {
        finishRecognizer()
        emitState("error", error.message ?: "Unable to start voice recognition.")
        promise.reject("start_failed", error.message, error)
      }
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      val activeRecognizer = recognizer
      if (activeRecognizer == null) {
        promise.resolve(false)
      } else {
        emitState("transcribing")
        activeRecognizer.stopListening()
        promise.resolve(true)
      }
    }
  }

  @ReactMethod
  fun cancel(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      recognizer?.cancel()
      finishRecognizer()
      emitState("idle")
      promise.resolve(true)
    }
  }

  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}
}
