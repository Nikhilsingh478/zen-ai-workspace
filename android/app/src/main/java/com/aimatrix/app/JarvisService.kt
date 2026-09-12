package com.aimatrix.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.KeywordSpotter
import com.k2fsa.sherpa.onnx.KeywordSpotterConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig

/**
 * JarvisService — always-on voice assistant foreground service.
 *
 * Architecture (explicit state machine, single microphone owner):
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                      STOPPED                                │
 *   │  No audio resource held. Service is idle or shut down.      │
 *   └───────────────────┬─────────────────────────────────────────┘
 *                       │ onStartCommand (default)
 *                       ▼
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                   WAKE_LISTENING                            │
 *   │  sherpa-onnx KWS owns AudioRecord (16kHz, mono, continuous) │
 *   │  PARTIAL_WAKE_LOCK held to keep CPU alive with screen off    │
 *   └───────────────────┬─────────────────────────────────────────┘
 *                       │ keyword detected / ACTION_START_COMMAND
 *                       ▼
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                  COMMAND_CAPTURING                          │
 *   │  Android SpeechRecognizer owns mic — single bounded session │
 *   │  KWS AudioRecord is fully released before SR starts         │
 *   └───────────────────┬─────────────────────────────────────────┘
 *                       │ result / error / timeout / ACTION_CANCEL_COMMAND
 *                       └──────► WAKE_LISTENING (loop)
 *
 * Why sherpa-onnx KWS instead of SpeechRecognizer for wake-word:
 *  - SpeechRecognizer times out every ~5s and must be torn down/rebuilt →
 *    mic cycles continuously (hardware open/close every few seconds).
 *  - sherpa-onnx KWS uses a single long-lived AudioRecord with a streaming
 *    Zipformer transducer — no timeouts, no restarts, low CPU, fully offline.
 *
 * The JS layer (jarvis-native.ts) calls JarvisPlugin methods which remain
 * unchanged — this refactor is transparent to the TypeScript bridge.
 */
class JarvisService : Service() {

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    companion object {
        private const val TAG = "JarvisService"

        // Notification channels
        const val CHANNEL_ASSISTANT = "jarvis_assistant"   // persistent service (LOW)
        const val CHANNEL_REMINDERS = "jarvis_reminders"   // scheduled reminders (HIGH)
        const val CHANNEL_SYSTEM    = "jarvis_system"      // system info (DEFAULT)
        const val CHANNEL_URGENT    = "jarvis_urgent"      // urgent alerts (HIGH)

        private const val NOTIF_ID = 1001

        // LocalBroadcast actions — JarvisPlugin listens for these
        const val WAKE_WORD_ACTION       = "com.aimatrix.app.WAKE_WORD"
        const val COMMAND_ACTION         = "com.aimatrix.app.COMMAND"
        const val EXTRA_PHRASE           = "phrase"
        const val EXTRA_CONFIDENCE       = "confidence"
        const val EXTRA_TRANSCRIPT       = "transcript"
        const val ACTION_START_COMMAND   = "com.aimatrix.app.START_COMMAND"
        const val ACTION_CANCEL_COMMAND  = "com.aimatrix.app.CANCEL_COMMAND"

        // KWS audio config — must match sherpa-onnx model's expected input
        private const val KWS_SAMPLE_RATE  = 16000
        private const val KWS_CHUNK_SAMPLES = 320   // 20ms at 16kHz
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State machine
    // ─────────────────────────────────────────────────────────────────────────

    private enum class JarvisState {
        STOPPED,
        WAKE_LISTENING,
        COMMAND_CAPTURING
    }

    @Volatile
    private var state = JarvisState.STOPPED

    // ─────────────────────────────────────────────────────────────────────────
    // sherpa-onnx KWS — wake-word detection
    // ─────────────────────────────────────────────────────────────────────────

    private var kwsSpotter: KeywordSpotter? = null
    private var kwsAudioRecord: AudioRecord? = null
    private var kwsThread: Thread? = null

    @Volatile
    private var kwsRunning = false

    // ─────────────────────────────────────────────────────────────────────────
    // SpeechRecognizer — command capture (bounded single session)
    // ─────────────────────────────────────────────────────────────────────────

    private var speechRecognizer: SpeechRecognizer? = null

    // ─────────────────────────────────────────────────────────────────────────
    // Wake lock — keeps CPU alive during screen-off KWS listening
    // ─────────────────────────────────────────────────────────────────────────

    private var wakeLock: PowerManager.WakeLock? = null

    // ─────────────────────────────────────────────────────────────────────────
    // Service lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "JarvisService created")
        createNotificationChannels()
        initKwsSpotter()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "onStartCommand: action=${intent?.action}")

        // Must call startForeground within 5s of service start on Android 9+
        startForeground(NOTIF_ID, buildPersistentNotification())

        when (intent?.action) {
            ACTION_START_COMMAND  -> transitionToCommandCapture()
            ACTION_CANCEL_COMMAND -> transitionToWakeListening()
            else -> {
                // Default start — begin listening for wake word
                if (state == JarvisState.STOPPED) {
                    transitionToWakeListening()
                }
            }
        }

        // START_STICKY: if the OS kills the service, restart it automatically
        return START_STICKY
    }

    override fun onDestroy() {
        Log.i(TAG, "JarvisService destroyed")
        transitionToStopped()
        kwsSpotter?.release()
        kwsSpotter = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ─────────────────────────────────────────────────────────────────────────
    // State transitions — each fully tears down previous state's audio resource
    // ─────────────────────────────────────────────────────────────────────────

    private fun transitionToWakeListening() {
        Log.i(TAG, "→ WAKE_LISTENING")
        // Ensure SpeechRecognizer (command mode) is fully released first
        releaseSpeechRecognizer()
        state = JarvisState.WAKE_LISTENING
        startKwsLoop()
    }

    private fun transitionToCommandCapture() {
        Log.i(TAG, "→ COMMAND_CAPTURING")
        // Ensure KWS AudioRecord is fully released before SpeechRecognizer takes mic
        stopKwsLoop()
        state = JarvisState.COMMAND_CAPTURING
        startCommandSession()
    }

    private fun transitionToStopped() {
        Log.i(TAG, "→ STOPPED")
        stopKwsLoop()
        releaseSpeechRecognizer()
        releaseWakeLock()
        state = JarvisState.STOPPED
    }

    // ─────────────────────────────────────────────────────────────────────────
    // sherpa-onnx KWS initialisation
    // ─────────────────────────────────────────────────────────────────────────

    private fun initKwsSpotter() {
        try {
            val config = KeywordSpotterConfig(
                featConfig = FeatureConfig(
                    sampleRate = KWS_SAMPLE_RATE,
                    featureDim = 80
                ),
                modelConfig = OnlineModelConfig(
                    transducer = OnlineTransducerModelConfig(
                        encoder = "jarvis-kws/encoder.int8.onnx",
                        decoder = "jarvis-kws/decoder.onnx",
                        joiner  = "jarvis-kws/joiner.int8.onnx"
                    ),
                    tokens    = "jarvis-kws/tokens.txt",
                    numThreads = 1,
                    debug      = false,
                    provider   = "cpu"
                ),
                keywordsFile      = "jarvis-kws/keywords.txt",
                keywordsScore     = 1.0f,
                keywordsThreshold = 0.25f,
                numTrailingBlanks = 1,
                maxActivePaths    = 4
            )
            kwsSpotter = KeywordSpotter(assetManager = assets, config = config)
            Log.i(TAG, "sherpa-onnx KWS initialised successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialise sherpa-onnx KWS: ${e.message}", e)
            // KWS is unavailable — service will still run for command mode
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KWS audio loop — runs on a dedicated background thread
    // ─────────────────────────────────────────────────────────────────────────

    private fun startKwsLoop() {
        val spotter = kwsSpotter
        if (spotter == null) {
            Log.w(TAG, "KWS spotter not available — wake word detection disabled")
            return
        }

        if (kwsRunning) {
            Log.d(TAG, "KWS loop already running")
            return
        }

        val bufferSize = maxOf(
            AudioRecord.getMinBufferSize(
                KWS_SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            ),
            KWS_CHUNK_SAMPLES * 2 * 4 // at least 4 chunks of buffer headroom
        )

        val audioRecord = try {
            AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                KWS_SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            ).also {
                if (it.state != AudioRecord.STATE_INITIALIZED) {
                    throw IllegalStateException("AudioRecord failed to initialise")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Cannot open AudioRecord for KWS: ${e.message}", e)
            return
        }

        kwsAudioRecord = audioRecord
        kwsRunning = true
        acquireWakeLock()

        val stream = spotter.createStream()
        audioRecord.startRecording()

        kwsThread = Thread({
            Log.i(TAG, "KWS audio thread started")
            val chunk = ShortArray(KWS_CHUNK_SAMPLES)

            while (kwsRunning) {
                val read = audioRecord.read(chunk, 0, chunk.size)
                if (read <= 0) continue

                // Convert PCM-16 short → float [-1.0, 1.0] as sherpa-onnx expects
                val floatSamples = FloatArray(read) { chunk[it] / 32768f }
                stream.acceptWaveform(floatSamples, sampleRate = KWS_SAMPLE_RATE)

                while (spotter.isReady(stream)) {
                    spotter.decode(stream)
                }

                val result = spotter.getResult(stream)
                if (result.keyword.isNotEmpty()) {
                    Log.i(TAG, "Wake word detected: '${result.keyword}'")
                    val phrase = result.keyword.trim().lowercase()
                        .replace("_", " ")   // HEY_JARVIS → hey jarvis
                    broadcastWakeWord(phrase, confidence = 0.9f)
                    // Reset stream after detection so it's ready for next keyword
                    spotter.reset(stream)
                    // Transition to command capture on the service's main thread
                    // (SpeechRecognizer requires main Looper)
                    if (state == JarvisState.WAKE_LISTENING) {
                        android.os.Handler(mainLooper).post {
                            if (state == JarvisState.WAKE_LISTENING) {
                                transitionToCommandCapture()
                            }
                        }
                    }
                }
            }

            // Clean up on thread exit
            try { audioRecord.stop() } catch (_: Exception) {}
            audioRecord.release()
            Log.i(TAG, "KWS audio thread stopped")
        }, "JarvisKwsThread").also { it.isDaemon = true }

        kwsThread!!.start()
    }

    private fun stopKwsLoop() {
        if (!kwsRunning) return
        Log.d(TAG, "Stopping KWS loop")
        kwsRunning = false
        kwsAudioRecord?.stop()    // unblocks audioRecord.read()
        kwsThread?.join(2000)     // wait up to 2s for clean exit
        kwsThread = null
        kwsAudioRecord = null
        releaseWakeLock()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SpeechRecognizer — bounded command capture session
    // ─────────────────────────────────────────────────────────────────────────

    private fun startCommandSession() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Log.w(TAG, "SpeechRecognizer not available — returning to wake mode")
            android.os.Handler(mainLooper).postDelayed({
                if (state == JarvisState.COMMAND_CAPTURING) transitionToWakeListening()
            }, 500)
            return
        }

        android.os.Handler(mainLooper).post {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).also {
                it.setRecognitionListener(commandListener)
            }

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 500L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1000L)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            }

            try {
                speechRecognizer?.startListening(intent)
                Log.d(TAG, "Command recognition started")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start command recognition: ${e.message}")
                releaseSpeechRecognizer()
                if (state == JarvisState.COMMAND_CAPTURING) transitionToWakeListening()
            }
        }
    }

    private fun releaseSpeechRecognizer() {
        try {
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
        } catch (_: Exception) {}
        speechRecognizer = null
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RecognitionListener for command mode (not used for wake-word)
    // ─────────────────────────────────────────────────────────────────────────

    private val commandListener = object : RecognitionListener {
        override fun onResults(results: android.os.Bundle?) {
            val transcript = results
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()?.trim().orEmpty()
            Log.d(TAG, "Command result: '$transcript'")
            releaseSpeechRecognizer()
            if (transcript.isNotBlank()) broadcastCommand(transcript)
            if (state == JarvisState.COMMAND_CAPTURING) transitionToWakeListening()
        }

        override fun onError(error: Int) {
            val msg = when (error) {
                SpeechRecognizer.ERROR_AUDIO             -> "audio"
                SpeechRecognizer.ERROR_CLIENT            -> "client"
                SpeechRecognizer.ERROR_NETWORK           -> "network"
                SpeechRecognizer.ERROR_NETWORK_TIMEOUT   -> "network_timeout"
                SpeechRecognizer.ERROR_NO_MATCH          -> "no_match"
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY   -> "recognizer_busy"
                SpeechRecognizer.ERROR_SERVER            -> "server"
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT    -> "speech_timeout"
                else                                     -> "unknown($error)"
            }
            Log.w(TAG, "Command recognition error: $msg")
            releaseSpeechRecognizer()
            if (state == JarvisState.COMMAND_CAPTURING) transitionToWakeListening()
        }

        // Required but unused for command mode
        override fun onReadyForSpeech(params: android.os.Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onPartialResults(partialResults: android.os.Bundle?) {}
        override fun onEvent(eventType: Int, params: android.os.Bundle?) {}
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Broadcast helpers — unchanged interface for JarvisPlugin
    // ─────────────────────────────────────────────────────────────────────────

    private fun broadcastWakeWord(phrase: String, confidence: Float) {
        val intent = Intent(WAKE_WORD_ACTION).apply {
            putExtra(EXTRA_PHRASE, phrase)
            putExtra(EXTRA_CONFIDENCE, confidence)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    private fun broadcastCommand(transcript: String) {
        LocalBroadcastManager.getInstance(this).sendBroadcast(
            Intent(COMMAND_ACTION).apply { putExtra(EXTRA_TRANSCRIPT, transcript) }
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Wake lock
    // ─────────────────────────────────────────────────────────────────────────

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AIMatrix:JarvisKwsLock").also {
            it.acquire() // no timeout — released explicitly in stopKwsLoop / onDestroy
        }
        Log.d(TAG, "Wake lock acquired")
    }

    private fun releaseWakeLock() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        Log.d(TAG, "Wake lock released")
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Notification infrastructure
    // ─────────────────────────────────────────────────────────────────────────

    private fun createNotificationChannels() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_ASSISTANT, "Jarvis Assistant", NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Persistent notification while Jarvis is active in the background"
            setShowBadge(false)
        })

        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_REMINDERS, "Reminders", NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Scheduled reminders and horizon events"
        })

        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_SYSTEM, "System", NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "System status and sync notifications"
        })

        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_URGENT, "Urgent Alerts", NotificationManager.IMPORTANCE_HIGH
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
            .setContentText("Say \"Jarvis\", \"Hey Jarvis\", or \"OK Jarvis\"…")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
