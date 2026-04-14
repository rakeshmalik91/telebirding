# Telebirding Cache & Offline Sync Flow

The overarching caching and offline synchronization logic is handled primarily via the `SiteCache` class, driving both first-run initializations and subsequent background updates. 

This document describes the correct execution flow step-by-step.

---

### Terminology

* **liveDir**: The current active cache served to the `WebView` offline.
* **stagingDir**: A temporary swap directory where background downloads occur. If a download succeeds cleanly, staging files are merged into `liveDir`.
* **shell files**: HTML, CSS, JS, Fonts, and Icon resources necessary for the interface to render.
* **data files**: The structured JSON payload mapping routes and entity paths (like taxa lists, stories).
* **media files**: Larger media payloads—chiefly images (JPG/PNG) and videos (MP4).

---

## 1. First Run (No Cached Site Exists)

On initial startup, `SiteCache.hasCachedSite` evaluates to `false`. The update is forced to run and block the initial UI.

1. **Discover Files**: Extracts necessary target endpoints for `shell files` and `data files` by parsing `index.html` and the structured Javascript/JSON data.
2. **Download Core Dependencies (Shell + Data)**: 
   * `shellFiles` and `dataFiles` are downloaded to `stagingDir`.
   * The download enforces a strict "No network timeout" policy. If the connection fails, updates are aborted. 
   * *404 Not Found* requests (e.g., deprecated UI icons) are swallowed, warned via logs, and do not crash the pipeline.
3. **Commit Shell Immediately**: So the user can immediately enter the app as fast as possible, `stagingDir` shell and data files are copied immediately into `liveDir` while the media begins downloading.
4. **Download all Media**: Parse the valid JSON files for referenced media targets (e.g. `images/`, `featured-images/`) and perform a background fetch for every listed item.
5. **Final Commit**: The application fully relies on `liveDir` directly.

**If the network fails during First Run:** 
An exception is explicitly thrown: `"Failed to download required initial files."` The user is warned on truthy failure.

---

## 2. Subsequent Runs & Background Update (Force Refresh)

On any subsequent run initiated automatically at startup or explicitly manually via `Swipe-to-Refresh`, the logic behaves identically but handles atomic rollbacks securely:

1. **Update Core Files (Shell + Data)**: 
   * `shellFiles` and `dataFiles` are downloaded to `stagingDir`.
   * **Atomic Evaluation Limit**: The transaction validates `allSuccessful`. If the internet connection drops mid-download, `success` evaluates to `false` and the update aborts early. The `liveDir` remains untouched and uncorrupted.
2. **Immediate Shell Promotion** (If Changed): If any changes occurred within the core files, they are safely promoted to `liveDir` so the user is not waiting for lengthy image lists to complete before utilizing new logic.
3. **Download Missing Media (Delta Media)**: 
   * `SiteCache` parses the JSON for media requirements and filters out any media paths that already exist in either `liveDir` or `stagingDir`.
   * Only **Missing or New** delta media targets are downloaded, saving critical bandwidth.
4. **Final Synchronization**:
   * If any media or files were retrieved successfully, they merge cleanly into `liveDir`.
   * **Remove Orphan Media**: After the merge, the routine crawls `liveDir/images`. Any file not referenced in the currently loaded structured datasets are deleted to prevent cache bulk hoarding. 

---

## 3. Cache Miss (Lazy Fetching)

During active offline use or in scenarios where a background media download hasn't finished:

* Any HTML/CSS/Media requests pass through `CachedWebViewClient.kt` via WebView's Intercept listener.
* If a file exists in `liveDir`, it is directly served via `FileInputStream`, saving bandwidth.
* If a file does **not** exist in `liveDir`, the interceptor triggers `lazyDownloadAndCache`.
* `lazyDownloadAndCache` opens an instantaneous synchronous stream. If the network successfully intercepts and fetches the file, it is automatically written downstream to `liveDir` while simulatenously passing the data downstream to WebView cleanly. `SiteCache.hasCachedSite` thus operates frictionlessly for on-demand caching.
