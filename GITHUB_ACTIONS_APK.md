# GitHub Actions - Automated APK Builds

## 📋 Overview

Two GitHub Actions workflows have been configured to automatically build Android APKs:

1. **Debug APK (Continuous)** - Builds on every commit to any branch
2. **Release APK** - Builds when publishing a GitHub release

## 🔄 Workflow 1: Debug APK (Continuous Build)

**File:** `.github/workflows/android_debug_apk.yaml`

### Triggers:

- ✅ Push to **any branch**
- ✅ Changes to app code, server, Android config, or workflows
- ✅ Manual trigger via "Run workflow" button

### What it does:

1. Checks out code
2. Installs Node.js and npm dependencies
3. Installs JDK 21 and Android SDK
4. Builds Nuxt static site (`npm run generate`)
5. Syncs to Capacitor (`npx cap sync android`)
6. Builds debug APK (`./gradlew assembleDebug`)
7. Renames APK with branch name and commit hash
8. Uploads APK as artifact (retained for 30 days)

### APK Naming:

```
skylite-{branch-name}-{commit-sha}-debug.apk
```

Examples:

- `skylite-main-a1b2c3d4-debug.apk`
- `skylite-develop-e5f6g7h8-debug.apk`
- `skylite-feature-meal-sync-12345678-debug.apk`

### Download Location:

1. Go to GitHub repository → **Actions** tab
2. Click on the workflow run
3. Scroll to bottom → **Artifacts** section
4. Download the APK zip file

### Use Cases:

- ✅ Testing changes on every commit
- ✅ Quick testing on feature branches
- ✅ Sideloading for immediate testing
- ✅ Sharing builds with testers

## 🎉 Workflow 2: Release APK

**File:** `.github/workflows/android_release_apk.yaml`

### Triggers:

- ✅ Publishing a GitHub **Release**
- ✅ Manual trigger with version input

### What it does:

1. All steps from debug workflow
2. Builds **both** debug and release APKs
3. Renames APKs with version tag
4. Uploads both as artifacts (retained for 90-365 days)
5. **Attaches APKs to the GitHub Release**
6. Generates detailed release notes

### APK Naming:

```
skylite-{version}-debug.apk
skylite-{version}-release-unsigned.apk
```

Examples:

- `skylite-v1.0.0-debug.apk`
- `skylite-v1.0.0-release-unsigned.apk`

### Download Locations:

1. **GitHub Release page** (recommended)
   - Go to repository → **Releases**
   - Click on the release
   - Download from **Assets** section at bottom

2. **Actions artifacts**
   - Same as debug workflow above

### Use Cases:

- ✅ Official releases
- ✅ Version-tagged APKs
- ✅ Long-term storage (365 days)
- ✅ Distribution to end users

## 📥 How to Download APKs

### From Release (Recommended):

1. Go to: https://github.com/{your-username}/Skylight/releases
2. Click on latest release
3. Scroll to **Assets** at bottom
4. Download `skylite-vX.X.X-debug.apk`

### From Actions Artifacts:

1. Go to: https://github.com/{your-username}/Skylight/actions
2. Click on a workflow run (green checkmark = success)
3. Scroll to **Artifacts** section at bottom
4. Click to download (downloads as ZIP)
5. Extract ZIP to get APK file

## 🚀 Creating a Release (To Trigger Release Workflow)

### Via GitHub Web UI:

1. Go to repository → **Releases** tab
2. Click **Draft a new release**
3. Click **Choose a tag** → Type version (e.g., `v1.0.0`) → **Create new tag**
4. Fill in release title: `SkyLite v1.0.0`
5. Add release notes describing changes
6. Click **Publish release**
7. Workflow automatically starts building APK

### Via GitHub CLI:

```bash
# Create and publish release
gh release create v1.0.0 --title "SkyLite v1.0.0" --notes "Release notes here"
```

### Via Git Tags:

```bash
# Create tag
git tag -a v1.0.0 -m "Version 1.0.0"

# Push tag
git push origin v1.0.0

# Then create release on GitHub from this tag
```

## ⚡ Manual Workflow Trigger

You can manually trigger workflows without pushing code:

1. Go to **Actions** tab
2. Select workflow (left sidebar):
   - "Build Debug APK (Continuous)" or
   - "Build Release APK"
3. Click **Run workflow** button (right side)
4. Select branch (for debug) or enter version (for release)
5. Click **Run workflow**

## 📊 Build Status

### Check Build Status:

- Repository main page shows workflow badges (if configured)
- Actions tab shows all workflow runs
- Green checkmark = Success ✅
- Red X = Failed ❌
- Yellow circle = Running 🟡

### Build Logs:

1. Click on workflow run
2. Click on job name (e.g., "Build Debug APK")
3. Expand steps to see detailed logs
4. Check for errors in red-highlighted steps

## 🔧 Workflow Features

### Automatic Optimizations:

- ✅ **Caching**: npm packages and Gradle dependencies cached
- ✅ **Parallel builds**: Can run multiple workflows simultaneously
- ✅ **Smart triggers**: Only runs when relevant files change
- ✅ **Build summaries**: Generates markdown summary with APK size

### Build Information:

Each workflow generates a summary showing:

- Branch and commit SHA
- APK size
- Download instructions
- Installation instructions
- Server setup guide

## 📱 Installing APKs on Android

### One-Time Setup:

1. Open **Settings** → **Security**
2. Enable **Unknown Sources** or **Install from Unknown Apps**
3. Allow your file manager/browser to install apps

### Installation Steps:

1. Download APK from GitHub
2. Transfer to Android device:
   - Email to yourself
   - USB file transfer
   - Cloud storage (Google Drive, Dropbox)
3. Open file manager on phone
4. Navigate to Downloads folder
5. Tap APK file
6. Tap **Install**
7. Open SkyLite app
8. Configure server URL in **Mobile Settings**

## 🛠️ Troubleshooting GitHub Actions

### Build Fails:

**Check logs:**

1. Actions tab → Click failed run
2. Look for red X steps
3. Expand step to see error

**Common issues:**

- ❌ Syntax error in code → Fix and push
- ❌ Missing dependency → Update package.json
- ❌ Gradle build failed → Check android/ config

### APK Not Attached to Release:

- Ensure workflow completed successfully (green checkmark)
- Refresh release page (may take 1-2 minutes)
- Check Actions artifacts as backup

### Workflow Not Triggering:

- Verify file paths in `on.push.paths` match changed files
- Check branch name matches trigger conditions
- Manual trigger always works (Run workflow button)

## 📈 Workflow Retention

### Artifact Retention:

- **Debug APKs**: 30 days
- **Release APKs**: 90 days (artifacts), 365 days (release assets)
- Can be extended in workflow YAML (`retention-days`)

### Storage Limits:

- GitHub Free: 500 MB storage, 2000 minutes/month
- GitHub Pro: 1 GB storage, 3000 minutes/month
- APKs are ~5-10 MB each
- Workflows use ~5-10 minutes per build

## 🎯 Best Practices

### Versioning:

- Use semantic versioning: `vMAJOR.MINOR.PATCH`
- Examples: `v1.0.0`, `v1.0.1`, `v2.0.0`
- Tag major releases, minor updates, and patches

### Testing:

- Test debug APK from continuous builds before release
- Create pre-releases for beta testing
- Use descriptive commit messages (appear in build names)

### Release Notes:

Include in releases:

- New features
- Bug fixes
- Breaking changes
- Installation instructions
- Server URL setup reminder

## 🔄 Updating Workflows

### Edit Workflows:

1. Edit `.github/workflows/*.yaml` files
2. Commit and push changes
3. Workflow automatically uses new version on next run

### Test Workflow Changes:

- Use `workflow_dispatch` trigger to test manually
- Check workflow run logs for errors
- Iterate and fix if needed

## 🎊 Summary

With these workflows, you get:

- ✅ Automatic APK builds on every commit
- ✅ Release APKs attached to GitHub releases
- ✅ No local Java/Android SDK setup needed
- ✅ Downloadable APKs from GitHub
- ✅ Version-tagged releases
- ✅ Build artifacts stored for 30-365 days

Just push code and GitHub Actions builds your APK automatically! 🚀
