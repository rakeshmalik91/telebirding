---
name: android-release
description: Standard procedure for releasing a new version of the Telebirding Android app. Use when creating a new release, bumping app version, updating release-notes.xml, building release APK/AAB packages, or meeting Google Play target API requirements.
---

# Android Release Procedure

This skill provides step-by-step instructions for agents to bump version numbers, update release notes, and assemble release packages for the Telebirding Android app.

---

## 🎯 Target Files & Execution Commands

- **Build Config**: [`telebirding-android-app/app/build.gradle.kts`](file:///d:/Projects/telebirding/telebirding-android-app/app/build.gradle.kts)
- **Release Notes**: [`telebirding-android-app/app/release-notes.xml`](file:///d:/Projects/telebirding/telebirding-android-app/app/release-notes.xml)
- **Working Directory**: `d:\Projects\telebirding\telebirding-android-app`

---

## 📋 Execution Steps

### 1. Update Version Numbers
In [`build.gradle.kts`](file:///d:/Projects/telebirding/telebirding-android-app/app/build.gradle.kts#L9-L16):
- Increment `versionCode` by 1 (e.g. `3` → `4`).
- Update `versionName` semver string (e.g. `"1.0.3"` → `"1.0.4"`).
- Ensure `compileSdk = 36` and `targetSdk = 36` (Android 16+ target API level).
- Ensure `isMinifyEnabled = true`, `isShrinkResources = true`, and `ndk { debugSymbolLevel = "FULL" }` are set under `buildTypes.release` (generates `mapping.txt` deobfuscation and native debug symbols for Google Play Console).

### 2. Update Release Notes XML
In [`release-notes.xml`](file:///d:/Projects/telebirding/telebirding-android-app/app/release-notes.xml):
- Add the new version block at the top of `<en-US>`:
```xml
<en-US>
    v1.0.4:
    - Target API level upgraded to Android 16 (API level 36)
    v1.0.3:
    - Offline data handling enhancements
</en-US>
```

### 3. Execute Release Build
Run from `telebirding-android-app/`:
```cmd
.\gradlew.bat assembleRelease
```
Or for Google Play AAB bundle:
```cmd
.\gradlew.bat bundleRelease
```

### 4. Verification Checklist
- [ ] `versionCode` and `versionName` updated in `app/build.gradle.kts`.
- [ ] Release notes recorded under `<en-US>` in `app/release-notes.xml`.
- [ ] Command output completed with `BUILD SUCCESSFUL`.
- [ ] Output binary generated at `app/build/outputs/apk/release/` or `app/build/outputs/bundle/release/`.
