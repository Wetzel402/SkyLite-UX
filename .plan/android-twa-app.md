# Android TWA App Implementation Plan

## Overview

Create a native Android APK wrapper for Skylite UX that:

- ✅ Allows configurable server URL (http://192.168.1.187:3000, http://skylite.local:3000, etc.)
- ✅ Works on HTTP (internal network, no HTTPS required)
- ✅ Full offline support via service workers
- ✅ Installable via sideloading (no Play Store)
- ✅ Native app feel with custom icon and splash screen
- ✅ Maintained in the same repository
- ✅ Auto-builds debug APK on every commit to main

## Approach: Custom WebView App with TWA Features

We'll create a **custom Android WebView application** (not pure TWA) because:

- **Standard TWA limitation**: URL is hardcoded in manifest, can't be changed without rebuilding
- **Custom WebView allows**: In-app settings screen to configure server URL
- **Best of both worlds**: Native app shell + web app content + full offline support

## Architecture

```
Skylight/
├── android/                          # NEW: Android app
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/skylite/ux/
│   │   │   │   ├── MainActivity.kt          # Main WebView activity
│   │   │   │   ├── SettingsActivity.kt      # Server URL config
│   │   │   │   └── WebViewClientCustom.kt   # Handle offline, etc.
│   │   │   ├── res/
│   │   │   │   ├── mipmap-*/                # App icons (generated from public/)
│   │   │   │   ├── layout/
│   │   │   │   │   ├── activity_main.xml
│   │   │   │   │   └── activity_settings.xml
│   │   │   │   ├── values/
│   │   │   │   │   ├── strings.xml
│   │   │   │   │   ├── colors.xml
│   │   │   │   │   └── themes.xml
│   │   │   │   └── xml/
│   │   │   │       └── network_security_config.xml  # Allow HTTP
│   │   │   └── AndroidManifest.xml
│   │   └── build.gradle.kts
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   ├── gradle.properties
│   └── gradlew*                     # Gradle wrapper (commit this)
├── scripts/
│   ├── generate-android-icons.js    # NEW: Auto-generate icon sizes
│   └── sync-android-version.js      # NEW: Sync version from package.json
├── .github/workflows/
│   └── android_build.yaml           # NEW: CI workflow
├── public/
│   ├── skylite-192.png              # Existing - source for Android icons
│   └── skylite-512.png
└── package.json                     # Add Android build scripts
```

## Current State Analysis

**Existing PWA Configuration** (from `nuxt.config.ts`):

- Manifest: `SkyLite UX` (name), `SkyLite` (short_name)
- Theme color: `#0ea5e9` (sky blue)
- Icons: `skylite-192.png`, `skylite-512.png`
- Service worker: Enabled with runtime caching
- Offline support: Already configured for meal plans API

**This means**:

- Android app will reuse existing service worker
- No web app code changes needed
- Icon assets already available

## Implementation Steps

### 1. Initialize Android Project Structure

Create basic Gradle project with Kotlin DSL:

**`android/settings.gradle.kts`**:

```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "SkyLite UX"
include(":app")
```

**`android/build.gradle.kts`**:

```kotlin
plugins {
    id("com.android.application") version "8.2.0" apply false
    id("org.jetbrains.kotlin.android") version "1.9.20" apply false
}
```

**`android/gradle.properties`**:

```properties
android.useAndroidX=true
android.enableJetifier=false
kotlin.code.style=official
```

**`android/app/build.gradle.kts`**:

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.skylite.ux"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.skylite.ux"
        minSdk = 24  // Android 7.0+ (service worker support)
        targetSdk = 34
        versionCode = 1
        versionName = "2026.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-DEBUG"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.webkit:webkit:1.9.0")  // WebView features
}
```

### 2. MainActivity - Main WebView Activity

**`android/app/src/main/java/com/skylite/ux/MainActivity.kt`**:

```kotlin
package com.skylite.ux

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Get server URL from preferences
        val prefs = getSharedPreferences("skylite", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", null)

        // First launch - go to settings
        if (serverUrl == null) {
            startActivity(Intent(this, SettingsActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)
        webView = findViewById(R.id.webview)

        // Configure WebView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            userAgentString = "$userAgentString SkyLite-Android/${BuildConfig.VERSION_NAME}"
        }

        webView.webViewClient = WebViewClientCustom()
        webView.loadUrl(serverUrl)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_settings -> {
                startActivity(Intent(this, SettingsActivity::class.java))
                true
            }
            R.id.action_reload -> {
                webView.reload()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
}
```

**`android/app/src/main/res/layout/activity_main.xml`**:

```xml
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
</FrameLayout>
```

### 3. SettingsActivity - Server URL Configuration

**`android/app/src/main/java/com/skylite/ux/SettingsActivity.kt`**:

```kotlin
package com.skylite.ux

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity

class SettingsActivity : AppCompatActivity() {
    private lateinit var urlInput: EditText
    private lateinit var saveButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        urlInput = findViewById(R.id.url_input)
        saveButton = findViewById(R.id.save_button)

        // Load current URL
        val prefs = getSharedPreferences("skylite", Context.MODE_PRIVATE)
        val currentUrl = prefs.getString("server_url", "http://192.168.1.187:3000")
        urlInput.setText(currentUrl)

        // Preset buttons
        findViewById<Button>(R.id.preset_ip).setOnClickListener {
            urlInput.setText("http://192.168.1.187:3000")
        }
        findViewById<Button>(R.id.preset_local).setOnClickListener {
            urlInput.setText("http://skylite.local:3000")
        }
        findViewById<Button>(R.id.preset_localhost).setOnClickListener {
            urlInput.setText("http://localhost:3000")
        }

        saveButton.setOnClickListener {
            val url = urlInput.text.toString().trim()
            if (url.isNotEmpty()) {
                prefs.edit().putString("server_url", url).apply()

                // Go to main activity
                val intent = Intent(this, MainActivity::class.java)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                startActivity(intent)
                finish()
            }
        }
    }
}
```

**`android/app/src/main/res/layout/activity_settings.xml`**:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Server URL"
        android:textSize="18sp"
        android:textStyle="bold" />

    <EditText
        android:id="@+id/url_input"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:hint="http://192.168.1.187:3000"
        android:inputType="textUri"
        android:layout_marginTop="8dp" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Presets"
        android:textSize="14sp"
        android:layout_marginTop="16dp" />

    <Button
        android:id="@+id/preset_ip"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="IP Address (192.168.1.187:3000)"
        style="?android:attr/buttonBarButtonStyle" />

    <Button
        android:id="@+id/preset_local"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Local Hostname (skylite.local:3000)"
        style="?android:attr/buttonBarButtonStyle" />

    <Button
        android:id="@+id/preset_localhost"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Localhost (localhost:3000)"
        style="?android:attr/buttonBarButtonStyle" />

    <Button
        android:id="@+id/save_button"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Save"
        android:layout_marginTop="24dp" />
</LinearLayout>
```

### 4. WebViewClientCustom - Handle Navigation

**`android/app/src/main/java/com/skylite/ux/WebViewClientCustom.kt`**:

```kotlin
package com.skylite.ux

import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class WebViewClientCustom : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        // Keep navigation in app (don't open external browser)
        return false
    }
}
```

### 5. Network Security Config - Allow HTTP

**`android/app/src/main/res/xml/network_security_config.xml`**:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow HTTP for local/internal network -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">192.168.0.0/16</domain>
        <domain includeSubdomains="true">10.0.0.0/8</domain>
        <domain includeSubdomains="true">172.16.0.0/12</domain>
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">local</domain>
    </domain-config>
</network-security-config>
```

### 6. AndroidManifest.xml

**`android/app/src/main/AndroidManifest.xml`**:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:networkSecurityConfig="@xml/network_security_config"
        android:supportsRtl="true"
        android:theme="@style/Theme.SkyLite"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <activity
            android:name=".SettingsActivity"
            android:exported="false"
            android:parentActivityName=".MainActivity" />
    </application>
</manifest>
```

### 7. Resources (Strings, Colors, Themes)

**`android/app/src/main/res/values/strings.xml`**:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">SkyLite UX</string>
    <string name="action_settings">Settings</string>
    <string name="action_reload">Reload</string>
</resources>
```

**`android/app/src/main/res/values/colors.xml`**:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="skylite_blue">#0ea5e9</color>
    <color name="white">#FFFFFF</color>
    <color name="black">#000000</color>
</resources>
```

**`android/app/src/main/res/values/themes.xml`**:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.SkyLite" parent="Theme.Material3.Light.NoActionBar">
        <item name="colorPrimary">@color/skylite_blue</item>
    </style>
</resources>
```

**`android/app/src/main/res/menu/main_menu.xml`**:

```xml
<?xml version="1.0" encoding="utf-8"?>
<menu xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto">
    <item
        android:id="@+id/action_reload"
        android:title="@string/action_reload"
        app:showAsAction="never" />
    <item
        android:id="@+id/action_settings"
        android:title="@string/action_settings"
        app:showAsAction="never" />
</menu>
```

### 8. Icon Generation Script

**`scripts/generate-android-icons.js`**:

```javascript
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const sizes = [
  { folder: "mipmap-mdpi", size: 48 },
  { folder: "mipmap-hdpi", size: 72 },
  { folder: "mipmap-xhdpi", size: 96 },
  { folder: "mipmap-xxhdpi", size: 144 },
  { folder: "mipmap-xxxhdpi", size: 192 }
];

const sourceIcon = path.join(__dirname, "..", "public", "skylite-512.png");
const androidRes = path.join(__dirname, "..", "android", "app", "src", "main", "res");

async function generateIcons() {
  for (const { folder, size } of sizes) {
    const outputDir = path.join(androidRes, folder);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, "ic_launcher.png");
    await sharp(sourceIcon)
      .resize(size, size)
      .toFile(outputPath);

    console.log(`Generated ${folder}/ic_launcher.png (${size}x${size})`);
  }
}

generateIcons().catch(console.error);
```

### 9. Version Sync Script

**`scripts/sync-android-version.js`**:

```javascript
const fs = require("node:fs");
const path = require("node:path");

const packageJson = require("../package.json");

const version = packageJson.version; // "2026.1.0"

// Convert "2026.1.0" to versionCode 20260100
const parts = version.split(".").map(Number);
const versionCode = parts[0] * 10000 + parts[1] * 100 + parts[2];

const gradlePath = path.join(__dirname, "..", "android", "app", "build.gradle.kts");
let gradleContent = fs.readFileSync(gradlePath, "utf8");

// Update versionCode
gradleContent = gradleContent.replace(
  /versionCode = \d+/,
  `versionCode = ${versionCode}`
);

// Update versionName
gradleContent = gradleContent.replace(
  /versionName = ".*?"/,
  `versionName = "${version}"`
);

fs.writeFileSync(gradlePath, gradleContent);
console.log(`Updated Android version to ${version} (code: ${versionCode})`);
```

### 10. CI/CD - GitHub Actions

**`.github/workflows/android_build.yaml`**:

```yaml
name: Android Build

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  build-debug:
    name: Build Debug APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"

      - name: Grant execute permission for gradlew
        run: chmod +x android/gradlew

      - name: Build debug APK
        run: cd android && ./gradlew assembleDebug

      - name: Upload debug APK
        uses: actions/upload-artifact@v4
        with:
          name: skylite-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
          retention-days: 90

  build-release:
    name: Build Release APK
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"

      - name: Decode keystore
        run: |
          echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > android/keystore.jks

      - name: Grant execute permission for gradlew
        run: chmod +x android/gradlew

      - name: Build release APK
        env:
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
        run: cd android && ./gradlew assembleRelease

      - name: Upload release APK
        uses: actions/upload-artifact@v4
        with:
          name: skylite-release-apk
          path: android/app/build/outputs/apk/release/app-release.apk

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: android/app/build/outputs/apk/release/app-release.apk
          name: ${{ github.ref_name }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 11. Update package.json

**Add scripts**:

```json
{
  "scripts": {
    "android:icons": "node scripts/generate-android-icons.js",
    "android:version": "node scripts/sync-android-version.js",
    "android:build:debug": "cd android && ./gradlew assembleDebug",
    "android:build:release": "cd android && ./gradlew assembleRelease",
    "android:install": "cd android && ./gradlew installDebug",
    "android:clean": "cd android && ./gradlew clean"
  },
  "devDependencies": {
    "sharp": "^0.33.1"
  }
}
```

### 12. Update .gitignore

**Add**:

```
# Android
android/local.properties
android/keystore.jks
android/keystore.properties
android/.gradle/
android/build/
android/app/build/
android/.idea/
android/*.iml
*.apk
*.aab
```

### 13. Documentation

**Create `docs/features/androidApp.md`** covering:

- Installation instructions (sideloading)
- Server URL configuration
- Troubleshooting
- Development guide

**Update `README.md`**:

- Add "📱 Android App" section
- Link to releases for APK downloads

## Distribution Workflow

### Development Builds (Every Commit to Main)

1. Push to `main` branch
2. GitHub Actions builds `app-debug.apk`
3. APK available as **artifact** in Actions tab
4. Download from: Actions → Workflow run → Artifacts → `skylite-debug-apk`
5. Valid for 90 days

### Release Builds (Manual Tags)

1. Create git tag: `git tag v2026.1.0 && git push --tags`
2. GitHub Actions builds signed `app-release.apk`
3. Creates GitHub Release with APK attached
4. Users download from Releases page
5. Permanent download link

## Testing Checklist

- [ ] First launch shows settings screen
- [ ] Server URL saves and persists
- [ ] WebView loads Skylite UX correctly
- [ ] Service worker registers
- [ ] Offline mode works (airplane mode test)
- [ ] Back button navigates within app
- [ ] Settings menu accessible
- [ ] Reload function works
- [ ] App survives rotation
- [ ] HTTP connections work on local network

## File Changes Summary

### New Files

- `android/` - Complete Android project (~30 files)
- `scripts/generate-android-icons.js`
- `scripts/sync-android-version.js`
- `.github/workflows/android_build.yaml`
- `docs/features/androidApp.md`

### Modified Files

- `package.json` - Add Android scripts + sharp dependency
- `.gitignore` - Add Android ignores
- `README.md` - Add Android app section
- `docs/features/index.md` - Link to Android docs

## Dependencies

**Development machine**:

- JDK 17+ (for local builds)
- Android SDK (optional - only if using Android Studio)
- Node.js + npm (already have)
- sharp npm package (for icon generation)

**CI/CD**:

- JDK 17 (provided by GitHub Actions)

## Success Criteria

- ✅ APK installs on Android devices
- ✅ Server URL configurable in-app
- ✅ Works on HTTP internal network
- ✅ Offline meal planning functional
- ✅ CI builds debug APK on every main commit
- ✅ Release APK on tagged versions
- ✅ Documentation complete

## Next Steps After Approval

1. Initialize Android project with Gradle
2. Create MainActivity, SettingsActivity, WebViewClient
3. Add resources (layouts, strings, themes)
4. Generate icon assets
5. Add build scripts to package.json
6. Set up CI workflow
7. Test on physical Android device
8. Document installation process
9. Create first debug build
