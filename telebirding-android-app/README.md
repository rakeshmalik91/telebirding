# Telebirding Android App

<div align="center">
	<img src="../icons/favicon-64x64.png" alt="Telebirding Logo" width="80"/>
	<br/>
	<b>Official Android Application for <a href="https://telebirding.info">telebirding.info</a></b>
</div>
<br/>

This is the official Android application for **Telebirding**, a personal blog and digital catalogue documenting bird sightings from across the Indian subcontinent.

## 📱 Download the App
Access the bird database on the go:
- **[Google Play Store](https://play.google.com/store/apps/details?id=com.rakeshmalik.telebirding)**
- **APK Archive**: [Google Drive](https://drive.google.com/drive/folders/1UNogisKp3rtcOnigcibAPiNsQB-gZJpD?usp=drive_link) | [Dropbox](https://www.dropbox.com/scl/fo/5t1zgkn419ctlzkuacu3h/ACC-_MbfOOu151yPRRH25XU?rlkey=3tirqkq5xland2qx3dfa8hrda&st=0aosjy2b&dl=0)

## Features

- **Offline Support**: The app implements a sophisticated local caching mechanism that allows you to browse site content even without an active internet connection.
- **Smart Update System**: Automatically checks for updates to site data and assets on startup. Supports background updates while you browse.
- **Enhanced WebView Experience**:
    - Optimized mobile viewport and scrolling.
    - Integrated pull-to-refresh for manual update checks.
    - Native "Scroll to Top" button for long pages.
- **Performance**: Intercepts web requests to serve assets (images, scripts, data) directly from local storage, reducing load times and data usage.

## Technical Details

- **Language**: Kotlin
- **UI Framework**: Jetpack Compose
- **Web Integration**: Custom `WebView` implementation with a specialized `CachedWebViewClient` and `SiteCache`.
- **Concurrency**: Kotlin Coroutines for efficient background downloading and file management.

## Project Structure

- `app/src/main/java/com/rakeshmalik/telebirding/`:
    - `MainActivity.kt`: Entry point and UI logic using Jetpack Compose.
    - `SiteCache.kt`: Manages the local copy of the website, handling downloads and file versioning. ([Read the detailed Cache & Sync Flow skill here](../.agents/skills/android-cache-flow/SKILL.md))
    - `CachedWebViewClient.kt`: Intercepts WebView requests to serve content from the local cache.

## Getting Started

1. Clone the repository.
2. Open the project in Android Studio.
3. Build and run the `app` module on an Android device or emulator.
