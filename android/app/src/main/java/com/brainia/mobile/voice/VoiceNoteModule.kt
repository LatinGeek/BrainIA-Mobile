package com.brainia.mobile.voice

import android.content.Intent
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class VoiceNoteModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var recognizer: SpeechRecognizer? = null
  override fun getName() = "BrainIAVoiceNote"
  private fun emit(text: String, final: Boolean) { context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("BrainIAVoiceTranscript", Arguments.createMap().apply { putString("text", text); putBoolean("final", final) }) }
  @ReactMethod fun start(promise: Promise) {
    if (!SpeechRecognizer.isRecognitionAvailable(context)) { promise.reject("unavailable", "Speech recognition is unavailable"); return }
    recognizer?.destroy(); recognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
      setRecognitionListener(object : android.speech.RecognitionListener {
        override fun onPartialResults(results: android.os.Bundle?) { results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let { emit(it, false) } }
        override fun onResults(results: android.os.Bundle?) { results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let { emit(it, true) } }
        override fun onError(error: Int) { if (error != SpeechRecognizer.ERROR_NO_MATCH && error != SpeechRecognizer.ERROR_SPEECH_TIMEOUT) promise.reject("recognition_error", "Voice recognition failed: $error") }
        override fun onReadyForSpeech(p: android.os.Bundle?) {} ; override fun onBeginningOfSpeech() {} ; override fun onRmsChanged(v: Float) {} ; override fun onBufferReceived(b: ByteArray?) {} ; override fun onEndOfSpeech() {} ; override fun onEvent(t: Int, p: android.os.Bundle?) {}
      })
      startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true))
    }; promise.resolve(true)
  }
  @ReactMethod fun stop() { recognizer?.stopListening() }
}
