# Next Steps to Build Android APK

## Current Status: 95% Complete! 🎉

All code is written and configured. You just need to install Java to build the APK.

## Step 1: Install Java (Required)

### Download JDK 17

<https://adoptium.net/temurin/releases/>

1. Click "Windows x64" MSI installer
2. Run the installer (accept all defaults)
3. Complete installation

### Set Environment Variables

#### Option A: GUI (Easier)

1. Open Start Menu → type "environment"
2. Click "Edit the system environment variables"
3. Click "Environment Variables" button
4. Under "System variables", click "New"
   - Variable name: `JAVA_HOME`
   - Variable value: `C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot` (or your version)
5. Find "Path" variable, click "Edit", click "New", add: `%JAVA_HOME%\bin`
6. Click OK on all dialogs
7. **Close and reopen Git Bash**

#### Option B: Command Line

```bash
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot"
setx PATH "%PATH%;%JAVA_HOME%\bin"
```

### Verify Installation

Close and reopen Git Bash, then run:

```bash
java -version
```

You should see: `openjdk version "17.0.x"`

## Step 2: Build the APK

```bash
# Navigate to your project directory
cd /path/to/your/SkyLite-UX
npm run android:build
```

This takes 2-5 minutes on first build (downloads dependencies).

### Output APK

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Step 3: Install on Phone

### Enable Unknown Sources

- Settings → Security → Unknown sources (ON)
- Or: Settings → Apps → Special access → Install unknown apps

### Transfer APK

- Email it to yourself
- Or USB: Connect phone → Copy APK to Downloads folder

### Install

- Open Files app on phone
- Navigate to Downloads
- Tap `app-debug.apk`
- Tap "Install"

## Step 4: Configure Server

### Find Server IP

```bash
ipconfig
```

Look for "IPv4 Address" (e.g., 192.168.1.100)

### In SkyLite App

- Open app
- Navigate to "Mobile Settings" (or tap gear icon)
- Enter: `http://192.168.1.100:3000` (use your IP)
- Tap "Save Settings"
- Restart app

## Step 5: Test Offline Mode

1. **Turn off WiFi** on phone
2. Open SkyLite → Meal Planner
3. Create a meal
4. Verify yellow "pending" indicator appears
5. Navigate to Offline Queue → verify meal listed

## Step 6: Test Sync

1. **Connect to home WiFi**
2. Open SkyLite app
3. Wait 30 seconds or tap "Sync Now"
4. Verify pending indicator disappears
5. Check web version → meal should appear

## That's It! 🎊

Your wife can now plan meals offline at work and sync when home.

## If Java Installation Fails

Alternative: Use Android Studio (includes Java):

1. Download Android Studio: https://developer.android.com/studio
2. Install (accept all defaults)
3. Skip the build and use: `npm run android:run` (opens in emulator)

## Rebuilding After Code Changes

Whenever you update the code:

```bash
npm run build:mobile  # Rebuild
npm run android:build # Create new APK
```

Then reinstall APK on phone.

## Quick Reference

| Task                    | Command                   |
| ----------------------- | ------------------------- |
| Build mobile web app    | `npm run build:mobile`    |
| Build debug APK         | `npm run android:build`   |
| Build release APK       | `npm run android:release` |
| Run on connected device | `npm run android:run`     |

APK Location: `android/app/build/outputs/apk/debug/app-debug.apk`

---

See `MOBILE_SETUP_STATUS.md` for full details and troubleshooting.
