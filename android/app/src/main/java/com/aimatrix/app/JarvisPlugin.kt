package com.aimatrix.app

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * JarvisPlugin — Capacitor bridge for the JarvisService foreground assistant.
 *
 * Exposes to JavaScript:
 *   - startJarvisService()   → starts the foreground service + wake-word listener
 *   - stopJarvisService()    → stops it cleanly
 *   - isServiceRunning()     → query current state
 *   - requestPermissions()   → runtime mic + notification permission flow
 *   - addListener("wakeWord", handler) → fires when "Hey Jarvis" is detected
 *
 * Usage from TypeScript (src/lib/platform/jarvis-native.ts):
 *   import { Jarvis } from '@/lib/platform/jarvis-native'
 *   await Jarvis.startJarvisService()
 *   Jarvis.addListener('wakeWord', ({ phrase }) => console.log(phrase))
 */
@CapacitorPlugin(
    name = "Jarvis",
    permissions = [
        Permission(
            alias = "microphone",
            strings = [Manifest.permission.RECORD_AUDIO]
        ),
        Permission(
            alias = "notifications",
            strings = [Manifest.permission.POST_NOTIFICATIONS]
        ),
    ]
)
class JarvisPlugin : Plugin() {

    companion object {
        private const val TAG = "JarvisPlugin"
    }

    // Receives LocalBroadcasts from JarvisService and forwards to JS
    private val wakeWordReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val phrase     = intent.getStringExtra(JarvisService.EXTRA_PHRASE) ?: return
            val confidence = intent.getFloatExtra(JarvisService.EXTRA_CONFIDENCE, 0f)
            Log.i(TAG, "Wake word received in plugin: $phrase")
            val data = JSObject().apply {
                put("phrase", phrase)
                put("confidence", confidence)
            }
            notifyListeners("wakeWord", data)
        }
    }

    override fun load() {
        // Register for wake-word broadcasts from JarvisService
        LocalBroadcastManager.getInstance(context).registerReceiver(
            wakeWordReceiver,
            IntentFilter(JarvisService.WAKE_WORD_ACTION)
        )
        Log.d(TAG, "JarvisPlugin loaded, wake-word receiver registered")
    }

    override fun handleOnDestroy() {
        LocalBroadcastManager.getInstance(context).unregisterReceiver(wakeWordReceiver)
        super.handleOnDestroy()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Plugin methods
    // ─────────────────────────────────────────────────────────────────────────

    @PluginMethod
    fun startJarvisService(call: PluginCall) {
        // Check microphone permission first
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            call.reject("Microphone permission not granted. Call requestPermissions() first.")
            return
        }

        try {
            val intent = Intent(context, JarvisService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            Log.i(TAG, "JarvisService started")
            call.resolve(JSObject().apply { put("success", true) })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start JarvisService: ${e.message}")
            call.reject("Failed to start Jarvis service: ${e.message}")
        }
    }

    @PluginMethod
    fun stopJarvisService(call: PluginCall) {
        try {
            context.stopService(Intent(context, JarvisService::class.java))
            Log.i(TAG, "JarvisService stopped")
            call.resolve(JSObject().apply { put("success", true) })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop JarvisService: ${e.message}")
            call.reject("Failed to stop Jarvis service: ${e.message}")
        }
    }

    @PluginMethod
    fun isServiceRunning(call: PluginCall) {
        // We use a lightweight check via ActivityManager
        val am = context.getSystemService(Context.ACTIVITY_SERVICE)
            as android.app.ActivityManager
        @Suppress("DEPRECATION")
        val running = am.getRunningServices(Int.MAX_VALUE).any {
            it.service.className == JarvisService::class.java.name
        }
        call.resolve(JSObject().apply { put("running", running) })
    }

    /**
     * Request microphone + notification permissions at runtime.
     * On Android < 13, POST_NOTIFICATIONS is granted automatically.
     * On Android 13+, we must ask explicitly.
     */
    @PluginMethod
    fun requestJarvisPermissions(call: PluginCall) {
        val permsToRequest = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            permsToRequest.add("microphone")
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) {
            permsToRequest.add("notifications")
        }

        if (permsToRequest.isEmpty()) {
            call.resolve(JSObject().apply {
                put("microphone", "granted")
                put("notifications", "granted")
            })
            return
        }

        requestPermissionForAliases(permsToRequest.toTypedArray(), call, "permissionsCallback")
    }

    @PermissionCallback
    private fun permissionsCallback(call: PluginCall) {
        val micGranted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

        val notifGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

        call.resolve(JSObject().apply {
            put("microphone",    if (micGranted)   "granted" else "denied")
            put("notifications", if (notifGranted) "granted" else "denied")
        })
    }
}
