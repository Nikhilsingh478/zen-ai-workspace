import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

let _isBackground = false;

export function initAppLifecycle(): void {
  if (!Capacitor.isNativePlatform()) return;

  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      // App came to foreground
      _isBackground = false;
      console.log('[App] Foreground — JARVIS active');
      // Wake word continues naturally — native service keeps running
    } else {
      // App went to background
      _isBackground = true;
      console.log('[App] Background — wake word continues via native service');
      // DO NOT stop wake word detection — native foreground service keeps it alive
      // DO stop command listening if active — mic releases for background
    }
  });

  App.addListener('backButton', ({ canGoBack }) => {
    if (!canGoBack) {
      // On Android back press from root — don't exit, go to background
      App.minimizeApp();
    }
  });
}

export function isAppInBackground(): boolean {
  return _isBackground;
}