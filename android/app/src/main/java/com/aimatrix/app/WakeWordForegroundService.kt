package com.aimatrix.app

import android.app.*
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground service required for background microphone access on Android 10+.
 * Shows a persistent notification while listening.
 * This is mandatory — Android kills background mic access without it.
 */
class WakeWordForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "jarvis_wake_word"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "START_WAKE_WORD"
        const val ACTION_STOP = "STOP_WAKE_WORD"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                startForeground(NOTIFICATION_ID, createNotification())
            }
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        // START_STICKY — system restarts service if killed
        // Important for always-on wake word
        return START_STICKY
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "JARVIS Wake Word",
            NotificationManager.IMPORTANCE_LOW // LOW = no sound, no popup
        ).apply {
            description = "JARVIS is listening for wake word"
            setShowBadge(false)
            enableLights(false)
            enableVibration(false)
        }

        getSystemService(NotificationManager::class.java)
            .createNotificationChannel(channel)
    }

    private fun createNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("JARVIS Active")
            .setContentText("Say \"Hey Jarvis\" to activate")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pendingIntent)
            .setOngoing(true)       // can't be dismissed
            .setSilent(true)        // no sound
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}