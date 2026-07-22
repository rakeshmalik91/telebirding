---
name: android-cache-flow
description: Architecture and step-by-step logic for the Telebirding Android app offline caching, staging/live directory swaps, delta media downloads, and lazy WebView interception. Use when working on Android offline storage, SiteCache.kt, CachedWebViewClient.kt, network sync, or web asset interception.
---

# Telebirding Cache & Offline Sync Flow

This skill describes the caching and offline synchronization architecture for agents modifying Android network or caching components.

---

## 🎯 Target Files & Components

- **Cache Engine**: [`SiteCache.kt`](file:///d:/Projects/telebirding/telebirding-app/app/src/main/java/com/rakeshmalik/telebirding/SiteCache.kt)
- **WebView Interceptor**: [`CachedWebViewClient.kt`](file:///d:/Projects/telebirding/telebirding-app/app/src/main/java/com/rakeshmalik/telebirding/CachedWebViewClient.kt)
- **Main Activity**: [`MainActivity.kt`](file:///d:/Projects/telebirding/telebirding-app/app/src/main/java/com/rakeshmalik/telebirding/MainActivity.kt)

---

## 🧩 Key Architecture Concepts

* **`liveDir`**: Active local cache directory served offline to `WebView`.
* **`stagingDir`**: Temporary workspace for downloading new updates. Files are merged into `liveDir` only after successful download verification.
* **Shell Files**: Core structural resources (`index.html`, CSS, JS scripts, fonts, UI icons).
* **Data Files**: Structured JSON files (`birds.json`, `places.json`, `taxa.json`).
* **Media Files**: Binary media assets (`images/*.jpg`, `videos/*.mp4`).

---

## ⚙️ Execution Flow

### 1. First Run (No Local Cache Exists)
When `SiteCache.hasCachedSite` evaluates to `false`:
1. **File Discovery**: Parse `index.html` and data endpoints to extract shell and data asset URLs.
2. **Download Core Shell & Data**: Download `shellFiles` and `dataFiles` into `stagingDir`.
3. **Immediate Shell Promotion**: Copy shell and data files into `liveDir` immediately so the UI renders fast while media downloads in the background.
4. **Media Fetch**: Download referenced media assets (`images/`, `featured-images/`) in background coroutines.
5. **Commit**: Finalize `liveDir` readiness.

### 2. Subsequent Runs & Background Update (Force Refresh)
Triggered automatically on startup or manually via `Swipe-to-Refresh`:
1. **Core Download**: Download fresh shell and data files into `stagingDir`.
2. **Atomic Rollback**: If network drops mid-download, `allSuccessful` evaluates to `false` and the update aborts. `liveDir` remains untouched and intact.
3. **Delta Media Sync**: Parse JSON files for required media and fetch **only missing/new media** not present in `liveDir`.
4. **Cleanup**: Crawl `liveDir/images` and prune orphan media no longer referenced in active JSON datasets.

### 3. WebView Interception & Lazy Cache (Cache Miss)
During active browsing:
1. `CachedWebViewClient.kt` intercepts all HTTP/HTTPS resource requests.
2. If resource exists in `liveDir`, serve directly via `FileInputStream` (zero network latency).
3. If resource is missing from `liveDir`, trigger `lazyDownloadAndCache` to stream network content, cache to `liveDir`, and return stream to `WebView`.
