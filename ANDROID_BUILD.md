# AI Matrix — Android APK Build Guide

The Android project is fully set up and ready for building. Since Android Studio requires
a local JDK + Android SDK, APK generation happens on your machine (not Replit).

---

## What's already done (in this repo)

- `android/` project generated with Capacitor 8
- App ID: `com.aimatrix.app`
- Min SDK: 26 (Android 8.0+), Target SDK: 35 (Android 15)
- Edge-to-edge rendering (status bar overlays WebView)
- Dark immersive theme — #0A0A0A background, no white flash
- Portrait orientation locked
- Permissions: Internet, Notifications, Microphone, Vibrate, Wake Lock, Image storage
- Hardware back button → minimize app at root (feels native, not browser)
- Native lifecycle (foreground/background state detection)
- Safe area insets (notch + nav bar support)
- Splash screen → fades into React animation seamlessly

---

## Prerequisites (on your local machine)

1. **Android Studio** — download from https://developer.android.com/studio
2. **JDK 17** — bundled with Android Studio (no separate install needed)
3. **Node.js 18+** — to run the sync script

---

## Step-by-step: Build a Debug APK

### 1. Clone / pull the repo to your local machine

```bash
git clone <your-repo-url>
cd <project-folder>
npm install
```

### 2. Sync the web build into the Android project

```bash
npm run cap:sync
# This runs: vite build → npx cap sync android
```

### 3. Open in Android Studio

```bash
npm run cap:open
# This runs: npx cap open android
```

Android Studio will open the `android/` folder as a Gradle project.
Let it finish syncing Gradle (first time takes 2–5 minutes).

### 4. Build the Debug APK

In Android Studio:
- Menu → **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- Output: `android/app/build/outputs/apk/debug/app-debug.apk`

Or via terminal (requires Android SDK in PATH):

```bash
cd android
./gradlew assembleDebug
```

APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Step-by-step: Build a Release APK

### 1. Create a signing keystore (one-time)

```bash
keytool -genkey -v -keystore aimatrix.keystore \
  -alias aimatrix -keyalg RSA -keysize 2048 -validity 10000
```

### 2. Configure signing in Android Studio

Go to: **Build → Generate Signed Bundle or APK → APK**
Select your keystore and fill in the credentials.

### 3. Build

Choose **Release** build variant and click **Finish**.

Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## Install on a device

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or simply transfer the APK file to your Android device and open it
(enable "Install from unknown sources" in Android Settings first).

---

## Updating the APK after code changes

Whenever you change the web app:

```bash
npm run cap:sync   # rebuilds web + syncs to android/
```

Then rebuild in Android Studio or with `./gradlew assembleDebug`.

---

## Future phases (architecture is ready)

- **Foreground service** — for persistent Jarvis assistant
- **Porcupine wake word** — always-on voice activation
- **Native push notifications** — via @capacitor/push-notifications
- **Play Store upload** — via AAB build (Build → Bundle)
