# Mobile Android APK Setup - Status Report

## ✅ Completed Steps

### Phase 1: Capacitor Installation

- ✅ Installed `@capacitor/core` and `@capacitor/cli`
- ✅ Initialized Capacitor with app ID: `com.skylite.app`
- ✅ Installed `@capacitor/android`, `@capacitor/network`, `@capacitor/preferences`
- ✅ Added Android platform (android/ directory created)

### Phase 2: HTTP Configuration

- ✅ Created `capacitor.config.ts` with HTTP support settings:
  - androidScheme: 'http' (allows HTTP without SSL)
  - cleartext: true (bypasses cleartext security)
  - allowMixedContent: true
  - WebView debugging enabled
- ✅ Created `android/app/src/main/res/xml/network_security_config.xml`:
  - Allows HTTP traffic for local networks (192.168.x.x, 10.x.x.x, localhost)
- ✅ Updated `android/app/src/main/AndroidManifest.xml`:
  - Added networkSecurityConfig reference
  - Added usesCleartextTraffic="true"

### Phase 3: Offline Sync Adaptation

- ✅ Updated `app/composables/useOfflineSync.ts`:
  - Added Capacitor Network API support
  - Falls back to browser API when not in Capacitor
  - Auto-detects Capacitor environment
  - Uses Network.getStatus() and networkStatusChange listener
- ✅ Created `app/plugins/capacitorConfig.client.ts`:
  - Detects Capacitor environment
  - Loads server URL from Preferences API
  - Overrides $fetch to prepend server URL for API calls
  - Default server URL: http://192.168.1.100:3000 (user configurable)

### Phase 4: UI and Configuration

- ✅ Created `app/pages/mobile-settings.vue`:
  - Settings page for configuring server URL
  - Shows network status (online/offline)
  - Shows pending sync count
  - Manual "Sync Now" button
  - Only visible in Capacitor environment
- ✅ Updated `package.json` with mobile build scripts:
  - `npm run generate` - Build static site
  - `npm run build:mobile` - Build and sync to Android
  - `npm run android:build` - Build debug APK
  - `npm run android:release` - Build release APK
  - `npm run android:run` - Run on connected device

### Phase 5: Nuxt Configuration

- ✅ Updated `nuxt.config.ts`:
  - Set `ssr: false` for client-only mode (required for Capacitor)
  - Configured for static generation
- ✅ Generated static build to `.output/public`
- ✅ Synced web assets to `android/app/src/main/assets/public`

## 🔧 Remaining Steps

### Install Build Prerequisites

To build the Android APK, you need:

#### 1. Install Java Development Kit (JDK)

**Download JDK 17 or 11:**

- JDK 17: https://adoptium.net/temurin/releases/
- Or JDK 11: https://adoptium.net/temurin/archive/

**Installation:**

1. Download Windows x64 MSI installer
2. Run installer (default options are fine)
3. Set JAVA_HOME environment variable:
   ```
   JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot
   ```
4. Add to PATH:
   ```
   PATH=%JAVA_HOME%\bin;%PATH%
   ```

**Verify installation:**

```bash
java -version
```

#### 2. Install Android SDK (Optional but Recommended)

**Option A: Install Android Studio (Full IDE)**

- Download: https://developer.android.com/studio
- Install Android Studio
- Open Android SDK Manager (Tools → SDK Manager)
- Install:
  - Android SDK Platform 34 (or latest)
  - Android SDK Build-Tools
  - Android SDK Command-line Tools
- Set ANDROID_HOME environment variable:
  ```
  ANDROID_HOME=C:\Users\nikhi\AppData\Local\Android\Sdk
  ```

**Option B: Command-line tools only**

- Download: https://developer.android.com/studio#command-tools
- Extract to a folder (e.g., C:\Android\cmdline-tools)
- Set ANDROID_HOME and update PATH

#### 3. Configure Android SDK Location

Create `android/local.properties` file:

```properties
sdk.dir=C:\\Users\\nikhi\\AppData\\Local\\Android\\Sdk
```

**Note:** Use double backslashes (\\\\) in the path.

### Build the APK

Once Java and Android SDK are installed:

#### Debug APK (for testing/sideloading):

```bash
cd "C:\Users\nikhi\OneDrive\Documents\Skylight"
npm run android:build
```

**Output:** `android/app/build/outputs/apk/debug/app-debug.apk`

#### Release APK (for production):

1. Generate keystore (one-time):

```bash
keytool -genkey -v -keystore skylite-release.keystore -alias skylite -keyalg RSA -keysize 2048 -validity 10000
```

2. Update `android/app/build.gradle` to add signing config (see plan for details)

3. Build release:

```bash
npm run android:release
```

**Output:** `android/app/build/outputs/apk/release/app-release.apk`

## 📱 Installing the APK

### On Android Phone:

1. **Enable Developer Options:**
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings → System → Developer Options
   - Enable "USB Debugging" (for cable installation)
   - Enable "Install via USB" or "Unknown sources" (for sideloading)

2. **Install APK:**
   - Transfer APK file to phone (USB, email, cloud storage)
   - Tap the APK file on phone
   - Allow installation from unknown sources if prompted
   - Tap "Install"

### Configure Server URL:

1. Launch SkyLite app
2. Navigate to "Mobile Settings" page
3. Enter your server IP: `http://192.168.1.X:3000` (find IP using `ipconfig` on server)
4. Tap "Save Settings"
5. Restart app

## 🔍 Testing the App

### Test Offline Mode:

1. Turn off WiFi on phone
2. Navigate to Meal Planner
3. Create meals - verify they show yellow "pending" indicators
4. Check Offline Queue page - verify meals are queued

### Test Sync:

1. Connect to home WiFi
2. Open SkyLite app
3. Wait 30 seconds or tap "Sync Now" in Mobile Settings
4. Verify pending meals disappear
5. Check web version on computer - verify meals appear

### Test HTTP Communication:

1. Connect Android phone to computer via USB
2. Enable USB debugging on phone
3. Run: `adb logcat | grep -E "Capacitor|SkyLite"`
4. Look for successful HTTP requests to server
5. Verify no SSL/cleartext errors

## 📁 Project Structure

```
Skylight/
├── android/                          # Native Android project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── assets/public/       # Synced web assets
│   │   │   ├── res/xml/
│   │   │   │   └── network_security_config.xml  # HTTP config
│   │   │   └── AndroidManifest.xml  # Updated with cleartext
│   │   └── build/outputs/apk/       # Built APK files (after build)
│   └── gradlew                      # Gradle wrapper
├── app/
│   ├── composables/
│   │   └── useOfflineSync.ts        # Updated with Capacitor Network API
│   ├── pages/
│   │   └── mobile-settings.vue      # New settings page
│   └── plugins/
│       └── capacitorConfig.client.ts # Server URL configuration
├── capacitor.config.ts              # Capacitor configuration
├── nuxt.config.ts                   # Updated with ssr: false
└── package.json                     # Updated with mobile scripts

```

## 🐛 Troubleshooting

### Build Issues:

**Error: JAVA_HOME is not set**

- Install JDK and set JAVA_HOME environment variable (see above)

**Error: SDK location not found**

- Create `android/local.properties` with sdk.dir path

**Error: Gradle build failed**

- Check `android/app/build/outputs/logs/` for details
- Try: `cd android && ./gradlew clean`

### Runtime Issues:

**Error: CLEARTEXT_NOT_PERMITTED**

- Verify `network_security_config.xml` exists
- Check AndroidManifest.xml has networkSecurityConfig attribute
- Rebuild APK after fixing

**Error: Cannot connect to server**

- Verify phone and server on same WiFi
- Check server IP is correct in Mobile Settings
- Verify server is running on port 3000
- Test server accessibility: Open browser on phone → http://192.168.1.X:3000

**Sync not working**

- Check Mobile Settings → Network Status shows "Online"
- Check Offline Queue page for error messages
- Check server logs for incoming requests

### Debugging Tools:

**View Android logs:**

```bash
adb logcat | grep -E "Capacitor|Chromium"
```

**Inspect WebView (Chrome DevTools):**

1. Connect phone via USB
2. Open Chrome on computer
3. Navigate to: chrome://inspect
4. Click "inspect" on SkyLite WebView

## ✨ Next Steps After APK Build

1. **Install APK on wife's phone**
2. **Configure server URL** in Mobile Settings
3. **Test offline meal creation** at work
4. **Test sync when home** on WiFi
5. **Verify multi-device sync** works

## 📝 Notes

- **No SSL required:** Native apps can use HTTP freely (no browser restrictions)
- **Existing code reused:** All Vue components, composables, and UI work as-is
- **Fast builds:** `npm run build:mobile` takes ~15 seconds after initial setup
- **Updates:** Just rebuild and reinstall APK when code changes
- **No Play Store needed:** Sideload APK directly

## 🎯 Success Criteria Checklist

- [x] Capacitor installed and configured
- [x] Android platform added
- [x] HTTP configuration complete
- [x] Offline sync adapted for Capacitor
- [x] Mobile settings page created
- [x] Build scripts added
- [x] Static build working
- [ ] **Java/JDK installed** ← YOU ARE HERE
- [ ] Android SDK installed (optional)
- [ ] Debug APK built successfully
- [ ] APK installs on Android phone
- [ ] App launches and displays UI
- [ ] HTTP requests work without SSL
- [ ] Offline meal creation works
- [ ] Auto-sync triggers when online
- [ ] Multi-device sync confirmed

## 🚀 Quick Start (After Installing Java)

```bash
# Build the mobile app
cd "C:\Users\nikhi\OneDrive\Documents\Skylight"
npm run build:mobile

# Build debug APK
npm run android:build

# Find APK at:
# android/app/build/outputs/apk/debug/app-debug.apk
```

Transfer this APK to Android phone and install!
