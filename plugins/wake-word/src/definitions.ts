export interface WakeWordPlugin {
  /**
   * Start listening for wake word in background.
   * Uses native audio VAD + lightweight detection.
   * Battery optimized — uses hardware audio processing.
   */
  startListening(options: {
    sensitivity: number  // 0.0 to 1.0, default 0.5
    cooldownMs: number   // ms between detections, default 3000
  }): Promise<void>

  /**
   * Stop all wake word detection.
   */
  stopListening(): Promise<void>

  /**
   * Check if currently listening.
   */
  isListening(): Promise<{ listening: boolean }>

  /**
   * Check if microphone permission is granted.
   */
  checkPermission(): Promise<{ granted: boolean }>

  /**
   * Request microphone permission.
   */
  requestPermission(): Promise<{ granted: boolean }>

  /**
   * Add listener for wake word detection events.
   * Fires when "Hey Jarvis" is detected.
   */
  addListener(
    eventName: 'wakeWordDetected',
    listenerFunc: (data: { score: number, timestamp: number }) => void
  ): Promise<{ remove: () => void }>

  /**
   * Add listener for error events.
   */
  addListener(
    eventName: 'error',
    listenerFunc: (data: { message: string }) => void
  ): Promise<{ remove: () => void }>

  /**
   * Remove all event listeners.
   */
  removeAllListeners(): Promise<void>
}