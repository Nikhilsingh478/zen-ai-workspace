package com.aimatrix.app

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Log
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.atomic.AtomicBoolean

class JarvisTtsHelper(private val context: Context) {
    companion object {
        private const val TAG = "JarvisTtsHelper"
        private const val MODEL_PATH = "jarvis-tts/model.onnx"
        private const val VOICES_PATH = "jarvis-tts/voices.bin"
        private const val TOKENS_PATH = "jarvis-tts/tokens.txt"
        private const val ASSET_DATA_DIR = "jarvis-tts/espeak-ng-data"
    }

    private val scope = CoroutineScope(Dispatchers.Default + Job())
    private var tts: OfflineTts? = null
    private var isInitialized = false
    private var isInitializing = false
    private var currentTrack: AudioTrack? = null
    private val isSpeaking = AtomicBoolean(false)

    private fun copyAssetDataDir(srcDir: String, destDir: File) {
        if (!destDir.exists()) {
            destDir.mkdirs()
        }
        val assetManager = context.assets
        val list = assetManager.list(srcDir) ?: return
        for (file in list) {
            val srcPath = if (srcDir.isEmpty()) file else "$srcDir/$file"
            val destFile = File(destDir, file)
            val children = assetManager.list(srcPath)
            if (children != null && children.isNotEmpty()) {
                copyAssetDataDir(srcPath, destFile)
            } else {
                if (!destFile.exists() || destFile.length() == 0L) {
                    try {
                        assetManager.open(srcPath).use { input ->
                            FileOutputStream(destFile).use { output ->
                                input.copyTo(output)
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Error copying asset file $srcPath", e)
                    }
                }
            }
        }
    }

    @Synchronized
    fun initialize(onReady: (() -> Unit)? = null) {
        if (isInitialized) {
            onReady?.invoke()
            return
        }
        if (isInitializing) return
        isInitializing = true

        scope.launch {
            try {
                // sherpa-onnx requires espeak-ng-data to reside on the physical filesystem
                val targetDataDir = File(context.filesDir, "espeak-ng-data")
                Log.d(TAG, "Preparing espeak-ng-data in ${targetDataDir.absolutePath}...")
                copyAssetDataDir(ASSET_DATA_DIR, targetDataDir)
                Log.d(TAG, "espeak-ng-data copy completed")

                val kokoroConfig = OfflineTtsKokoroModelConfig(
                    model = MODEL_PATH,
                    voices = VOICES_PATH,
                    tokens = TOKENS_PATH,
                    dataDir = targetDataDir.absolutePath,
                    lexicon = "",
                    lang = "en-us",
                    dictDir = "",
                    lengthScale = 1.0f
                )

                val modelConfig = OfflineTtsModelConfig(
                    kokoro = kokoroConfig,
                    numThreads = 2,
                    debug = false,
                    provider = "cpu"
                )

                val ttsConfig = OfflineTtsConfig(
                    model = modelConfig,
                    maxNumSentences = 1
                )

                Log.d(TAG, "Initializing Kokoro OfflineTts...")
                val instance = OfflineTts(assetManager = context.assets, config = ttsConfig)
                synchronized(this@JarvisTtsHelper) {
                    tts = instance
                    isInitialized = true
                    isInitializing = false
                }
                Log.d(TAG, "Kokoro OfflineTts initialized successfully (sampleRate=${instance.sampleRate()}, speakers=${instance.numSpeakers()})")
                withContext(Dispatchers.Main) {
                    onReady?.invoke()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to initialize OfflineTts", e)
                synchronized(this@JarvisTtsHelper) {
                    isInitializing = false
                }
            }
        }
    }

    fun speak(text: String, sid: Int = 0, speed: Float = 1.0f, onDone: (() -> Unit)? = null) {
        if (text.isBlank()) {
            onDone?.invoke()
            return
        }

        stopSpeaking()

        scope.launch {
            try {
                if (!isInitialized) {
                    initialize()
                    // Wait for initialization (max 10s)
                    var attempts = 0
                    while (!isInitialized && attempts < 100) {
                        kotlinx.coroutines.delay(100)
                        attempts++
                    }
                }

                val engine = tts
                if (engine == null) {
                    Log.e(TAG, "TTS engine not ready")
                    withContext(Dispatchers.Main) { onDone?.invoke() }
                    return@launch
                }

                isSpeaking.set(true)
                Log.d(TAG, "Synthesizing text: \"$text\" with sid=$sid, speed=$speed")
                val audio = engine.generate(text = text, sid = sid, speed = speed)
                val samples = audio.samples
                val sampleRate = audio.sampleRate

                if (samples.isEmpty()) {
                    Log.w(TAG, "No audio generated for text: \"$text\"")
                    isSpeaking.set(false)
                    withContext(Dispatchers.Main) { onDone?.invoke() }
                    return@launch
                }

                playAudio(samples, sampleRate, onDone)
            } catch (e: Exception) {
                Log.e(TAG, "Error generating or playing speech", e)
                isSpeaking.set(false)
                withContext(Dispatchers.Main) { onDone?.invoke() }
            }
        }
    }

    private fun playAudio(samples: FloatArray, sampleRate: Int, onDone: (() -> Unit)?) {
        try {
            val minBufferSize = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_FLOAT
            )
            val bufferSize = maxOf(minBufferSize, samples.size * 4)

            val audioTrack = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                        .setSampleRate(sampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()

            synchronized(this) {
                currentTrack = audioTrack
            }

            audioTrack.write(samples, 0, samples.size, AudioTrack.WRITE_BLOCKING)
            audioTrack.play()

            // Calculate duration in ms
            val durationMs = ((samples.size.toDouble() / sampleRate) * 1000).toLong()
            Thread.sleep(durationMs + 100)

            audioTrack.stop()
            audioTrack.release()
            synchronized(this) {
                if (currentTrack == audioTrack) {
                    currentTrack = null
                }
            }
            isSpeaking.set(false)
            onDone?.invoke()
        } catch (e: Exception) {
            Log.e(TAG, "Error during audio playback", e)
            isSpeaking.set(false)
            onDone?.invoke()
        }
    }

    fun stopSpeaking() {
        isSpeaking.set(false)
        try {
            synchronized(this) {
                currentTrack?.apply {
                    if (playState == AudioTrack.PLAYSTATE_PLAYING) {
                        pause()
                        flush()
                        stop()
                    }
                    release()
                }
                currentTrack = null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping AudioTrack", e)
        }
    }

    fun isSpeakingNow(): Boolean = isSpeaking.get()

    fun release() {
        stopSpeaking()
        synchronized(this) {
            tts?.release()
            tts = null
            isInitialized = false
        }
    }
}
