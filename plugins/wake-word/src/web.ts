import { WebPlugin } from '@capacitor/core'
import type { WakeWordPlugin } from './definitions'

export class WakeWordWeb extends WebPlugin implements WakeWordPlugin {
  async startListening(): Promise<void> {
    // Web fallback — native wake word not available in browser
    // The existing openwakeword-wasm-browser handles this on web
    console.log('[WakeWord Native] Web platform — using browser fallback')
  }

  async stopListening(): Promise<void> {}

  async isListening(): Promise<{ listening: boolean }> {
    return { listening: false }
  }

  async checkPermission(): Promise<{ granted: boolean }> {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return { granted: result.state === 'granted' }
  }

  async requestPermission(): Promise<{ granted: boolean }> {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      return { granted: true }
    } catch {
      return { granted: false }
    }
  }
}