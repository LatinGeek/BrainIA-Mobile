package com.brainia.mobile.voice
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
class VoiceNotePackage : ReactPackage { override fun createNativeModules(c: ReactApplicationContext): List<NativeModule> = listOf(VoiceNoteModule(c)); override fun createViewManagers(c: ReactApplicationContext): List<ViewManager<*, *>> = emptyList() }
