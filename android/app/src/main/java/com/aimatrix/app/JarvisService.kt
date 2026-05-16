package com.aimatrix.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager

/**
 * JarvisService — Phase 1 foreground service foundation.
 *
 * Keeps the app alive in the background and provides:
 *  1. A persistent foreground notification (prevents Android from killing the process)
 *  2. Continuous speech recognition loop for wake-word detection ("hey jarvis" / "jarvis")
 *  3. Notification channel infrastructure for Phase 4 push/reminder system
 *
 * Architecture:
 *  - Runs on the main thread (SpeechRecognizer requires a Looper thread)
 *  - Restarts recognition after each result, error, or timeout via a Handler delay
 *  - Broadcasts wake-word detection via LocalBroadcastManager → JarvisPlugin → JS layer
 *
 * Android SpeechRecognizer limitations (documented honestly):
 *  - Requires an active internet connection (routes audio to Google Speech API)
 *  - Times out after ~5-10 seconds of silence → we restart immediately
 *  - NOT a true always-on offline model (that's Porcupine — Phase 3)
 *  - On some devices, Google may throttle rapid consecutive recognition requests
 *  - Battery impact: moderate (microphone + network). WakeLock is NOT held by default.
 *
 * This gives you the correct foreground service architecture for Phase 2 + Phase 3
 * without requiring Porcupine yet.
 */
class JarvisService : Service(), RecognitionListener {

    companion object {
        private const val TAG = "JarvisService"

        // Notification channels
        const val CHANNEL_ASSISTANT  = "jarvis_assistant"   // persistent service (LOW)
        const val CHANNEL_REMINDERS  = "jarvis_reminders"   // scheduled reminders (HIGH)
        const val CHANNEL_SYSTEM     = "jarvis_system"      // system info (DEFAULT)
        const val CHANNEL_URGENT     = "jarvis_urgent"      // urgent alerts (HIGH)

        // Foreground notification ID
        private const val NOTIF_ID = 1001

        // LocalBroadcast action — JarvisPlugin listens for this
        const val WAKE_WORD_ACTION = "com.aimatrix.app.WAKE_WORD"
        const val EXTRA_PHRASE     = "phrase"
        const val EXTRA_CONFIDENCE = "confidence"

        // Wake-word tokens to match (case-insensitive)
        private val WAKE_WORDS = listOf("jarvis", "hey jarvis", "ok jarvis", "hi jarvis")

        // Delay before restarting recognition after result/error (ms)
        private const val RESTART_DELAY_MS = 500L
        private const val ERROR_RESTART_DELAY_MS = 1500L
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private val handler = Handler(Looper.getMainLooper())
    private var isListening = false
    private var isServiceRunning = false

    // ─────────────────────────────────────────────────────────────────────────
    // Service lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "JarvisService created")
        createNotificationChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "JarvisService starting foreground")

        // Start foreground immediately — must happen within 5 s on Android 9+
        startForeground(NOTIF_ID, buildPersistentNotification())
        isServiceRunning = true

        if (SpeechRecognizer.isRecognitionAvailable(this)) {
            initSpeechRecognizer()
            startListening()
        } else {
            Log.w(TAG, "SpeechRecognizer not available on this device — wake word disabled")
        }

        // START_STICKY: if the OS kills the service, restart it automatically
        return START_STICKY
    }

    override fun onDestroy() {
        Log.i(TAG, "JarvisService destroyed")
        isServiceRunning = false
        isListening = false
        handler.removeCallbacksAndMessages(null)
        speechRecognizer?.destroy()
        speechRecognizer = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ─────────────────────────────────────────────────────────────────────────
    // Notification infrastructure
    // ─────────────────────────────────────────────────────────────────────────

    private fun createNotificationChannels() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Assistant — persistent service notification, silent
        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_ASSISTANT,
            "Jarvis Assistant",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Persistent notification while Jarvis is active in the background"
            setShowBadge(false)
        })

        // Reminders — high priority, makes sound
        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_REMINDERS,
            "Reminders",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Scheduled reminders and horizon events"
        })

        // System — informational, default priority
        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_SYSTEM,
            "System",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "System status and sync notifications"
        })

        // Urgent — high priority alerts
        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_URGENT,
            "Urgent Alerts",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Time-critical alerts that require immediate attention"
        })

        Log.i(TAG, "Notification channels created")
    }

    private fun buildPersistentNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ASSISTANT)
            .setContentTitle("Jarvis is active")
            .setContentText("Listening for \"Hey Jarvis\"…")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pendingIntent)
            .setOngoing(true)          // cannot be dismissed by swipe
            .setSilent(true)           // no sound on create/update
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SpeechRecognizer — continuous loop
    // ─────────────────────────────────────────────────────────────────────────

    private fun initSpeechRecognizer() {
        speechRecognizer?.destroy()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).also {
            it.setRecognitionListener(this)
        }
    }

    private fun startListening() {
        if (!isServiceRunning) return
        if (isListening) return

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
            // Keep listening longer before timing out
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1000L)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }

        try {
            speechRecognizer?.startListening(intent)
            isListening = true
            Log.d(TAG, "Recognition started")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recognition: ${e.message}")
            scheduleRestart(ERROR_RESTART_DELAY_MS)
        }
    }

    private fun scheduleRestart(delayMs: Long = RESTART_DELAY_MS) {
        isListening = false
        handler.postDelayed({
            if (isServiceRunning) {
                // Re-create recognizer on each cycle to avoid state leaks
                initSpeechRecognizer()
                startListening()
            }
        }, delayMs)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Wake-word detection
    // ─────────────────────────────────────────────────────────────────────────

    private fun checkForWakeWord(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return
        val confidences = results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)

        matches.forEachIndexed { index, phrase ->
            val lower = phrase.lowercase().trim()
            if (WAKE_WORDS.any { lower.contains(it) }) {
                val confidence = confidences?.getOrNull(index) ?: 0f
                Log.i(TAG, "Wake word detected: \"$phrase\" (confidence=$confidence)")
                broadcastWakeWord(phrase, confidence)
                return
            }
        }
    }

    private fun broadcastWakeWord(phrase: String, confidence: Float) {
        val intent = Intent(WAKE_WORD_ACTION).apply {
            putExtra(EXTRA_PHRASE, phrase)
            putExtra(EXTRA_CONFIDENCE, confidence)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RecognitionListener implementation
    // ─────────────────────────────────────────────────────────────────────────

    override fun onResults(results: Bundle?) {
        Log.d(TAG, "onResults")
        checkForWakeWord(results)
        scheduleRestart(RESTART_DELAY_MS)
    }

    override fun onPartialResults(partialResults: Bundle?) {
        // Check partial results too for faster wake-word response
        checkForWakeWord(partialResults)
    }

    override fun onError(error: Int) {
        val msg = when (error) {
            SpeechRecognizer.ERROR_AUDIO             -> "audio"
            SpeechRecognizer.ERROR_CLIENT            -> "client"
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "permissions"
            SpeechRecognizer.ERROR_NETWORK           -> "network"
            SpeechRecognizer.ERROR_NETWORK_TIMEOUT   -> "network_timeout"
            SpeechRecognizer.ERROR_NO_MATCH          -> "no_match"
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY   -> "recognizer_busy"
            SpeechRecognizer.ERROR_SERVER            -> "server"
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT    -> "speech_timeout"
            else                                     -> "unknown($error)"
        }
        Log.w(TAG, "Recognition error: $msg")

        // Longer delay on network/server errors to avoid hammering the API
        val delay = when (error) {
            SpeechRecognizer.ERROR_NETWORK,
            SpeechRecognizer.ERROR_NETWORK_TIMEOUT,
            SpeechRecognizer.ERROR_SERVER -> 3000L
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> 2000L
            else -> ERROR_RESTART_DELAY_MS
        }
        scheduleRestart(delay)
    }

    override fun onEndOfSpeech() {
        Log.d(TAG, "onEndOfSpeech")
        isListening = false
    }

    // Required but unused callbacks
    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEvent(eventType: Int, params: Bundle?) {}
}
