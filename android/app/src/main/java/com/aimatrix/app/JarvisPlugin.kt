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
 * JarvisPlugin — Capacitor bridge for the JarvisService foreground assistant,
 * offline Kokoro-82M TTS, and background battery exemption management.
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

    private var ttsHelper: JarvisTtsHelper? = null

    // Receives LocalBroadcasts from JarvisService and forwards to JS
    private val wakeWordReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val phrase = intent.getStringExtra(JarvisService.EXTRA_PHRASE) ?: return
            val confidence = intent.getFloatExtra(JarvisService.EXTRA_CONFIDENCE, 0f)
            Log.i(TAG, "Wake word received in plugin: $phrase")
            val data = JSObject().apply {
                put("phrase", phrase)
                put("confidence", confidence)
            }
            notifyListeners("wakeWord", data)
        }
    }

    private val commandReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val transcript = intent.getStringExtra(JarvisService.EXTRA_TRANSCRIPT) ?: return
            notifyListeners("command", JSObject().apply { put("transcript", transcript) })
        }
    }

    override fun load() {
        // Register for wake-word broadcasts from JarvisService
        LocalBroadcastManager.getInstance(context).registerReceiver(
            wakeWordReceiver,
            IntentFilter(JarvisService.WAKE_WORD_ACTION)
        )
        LocalBroadcastManager.getInstance(context).registerReceiver(
            commandReceiver,
            IntentFilter(JarvisService.COMMAND_ACTION)
        )

        // Initialize TTS Helper in background
        ttsHelper = JarvisTtsHelper(context).apply {
            initialize()
        }

        Log.d(TAG, "JarvisPlugin loaded, receivers registered, TTS initializing")
    }

    override fun handleOnDestroy() {
        LocalBroadcastManager.getInstance(context).unregisterReceiver(wakeWordReceiver)
        LocalBroadcastManager.getInstance(context).unregisterReceiver(commandReceiver)
        ttsHelper?.release()
        ttsHelper = null
        super.handleOnDestroy()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Jarvis Service Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    @PluginMethod
    fun startJarvisService(call: PluginCall) {
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
    fun startCommandListening(call: PluginCall) {
        try {
            val intent = Intent(context, JarvisService::class.java).apply {
                action = JarvisService.ACTION_START_COMMAND
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            call.resolve(JSObject().apply { put("success", true) })
        } catch (e: Exception) {
            call.reject("Failed to start native command recognition: ${e.message}")
        }
    }

    @PluginMethod
    fun cancelCommandListening(call: PluginCall) {
        try {
            val intent = Intent(context, JarvisService::class.java).apply {
                action = JarvisService.ACTION_CANCEL_COMMAND
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            call.resolve(JSObject().apply { put("success", true) })
        } catch (e: Exception) {
            call.reject("Failed to cancel native command recognition: ${e.message}")
        }
    }

    @PluginMethod
    fun isServiceRunning(call: PluginCall) {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        @Suppress("DEPRECATION")
        val running = am.getRunningServices(Int.MAX_VALUE).any {
            it.service.className == JarvisService::class.java.name
        }
        call.resolve(JSObject().apply { put("running", running) })
    }

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
            put("microphone", if (micGranted) "granted" else "denied")
            put("notifications", if (notifGranted) "granted" else "denied")
        })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Native TTS (Kokoro-82M Offline)
    // ─────────────────────────────────────────────────────────────────────────

    @PluginMethod
    fun speak(call: PluginCall) {
        val text = call.getString("text")
        if (text.isNullOrBlank()) {
            call.resolve(JSObject().apply { put("success", true) })
            return
        }

        val sid = call.getInt("sid", 0) ?: 0
        val speed = call.getFloat("speed", 1.0f) ?: 1.0f

        val helper = ttsHelper ?: JarvisTtsHelper(context).also { ttsHelper = it }

        helper.speak(text, sid, speed) {
            notifyListeners("ttsDone", JSObject().apply { put("text", text) })
        }
        call.resolve(JSObject().apply { put("success", true) })
    }

    @PluginMethod
    fun stopSpeaking(call: PluginCall) {
        ttsHelper?.stopSpeaking()
        call.resolve(JSObject().apply { put("success", true) })
    }

    @PluginMethod
    fun isSpeaking(call: PluginCall) {
        val speaking = ttsHelper?.isSpeakingNow() ?: false
        call.resolve(JSObject().apply { put("speaking", speaking) })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Battery Exemption & OEM Autostart
    // ─────────────────────────────────────────────────────────────────────────

    @PluginMethod
    fun checkBatteryOptimization(call: PluginCall) {
        val isIgnoring = BatteryOptimizationHelper.isIgnoringBatteryOptimizations(context)
        call.resolve(JSObject().apply {
            put("isIgnoringBatteryOptimizations", isIgnoring)
        })
    }

    @PluginMethod
    fun requestBatteryOptimization(call: PluginCall) {
        try {
            val intent = BatteryOptimizationHelper.createRequestBatteryOptimizationIntent(context)
            context.startActivity(intent)
            call.resolve(JSObject().apply { put("success", true) })
        } catch (e: Exception) {
            call.reject("Failed to launch battery optimization request: ${e.message}")
        }
    }

    @PluginMethod
    fun checkOemBatteryRestrictions(call: PluginCall) {
        val oemInfo = BatteryOptimizationHelper.getOemInfo()
        val isIgnoring = BatteryOptimizationHelper.isIgnoringBatteryOptimizations(context)
        call.resolve(JSObject().apply {
            put("manufacturer", oemInfo["manufacturer"])
            put("oemCategory", oemInfo["oemCategory"])
            put("hasSpecialAutostart", oemInfo["hasSpecialAutostart"])
            put("isIgnoringBatteryOptimizations", isIgnoring)
        })
    }

    @PluginMethod
    fun openOemAutostartSettings(call: PluginCall) {
        val intent = BatteryOptimizationHelper.getOemAutostartIntent(context)
        if (intent != null) {
            try {
                context.startActivity(intent)
                call.resolve(JSObject().apply { put("success", true) })
            } catch (e: Exception) {
                call.reject("Failed to open OEM settings: ${e.message}")
            }
        } else {
            call.resolve(JSObject().apply {
                put("success", false)
                put("reason", "No OEM-specific autostart screen found")
            })
        }
    }
}
