package com.rakeshmalik.telebirding

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import org.json.JSONArray

/**
 * Manages a complete local copy of the telebirding website.
 *
 * Architecture:
 * - Maintains a "live" cache directory that the WebView serves from
 * - On update: downloads changes to a "staging" directory
 * - Only swaps staging → live if ALL downloads succeed (atomic)
 * - If any download fails, staging is discarded; live cache is untouched
 *
 * Directory structure:
 *   files/site-cache/live/          ← WebView serves from here
 *   files/site-cache/staging/       ← Temporary download area
 */
class SiteCache(private val context: Context) {

    companion object {
        private const val TAG = "SiteCache"

        private const val SITE_BASE_URL = "https://telebirding.info"
        private const val FIREBASE_STORAGE_BASE =
            "https://firebasestorage.googleapis.com/v0/b/telebirding-49623.appspot.com/o/"

        private const val CACHE_DIR = "site-cache"
        private const val LIVE_DIR = "live"
        private const val STAGING_DIR = "staging"

        // Shell files served from the website hosting
        private val SHELL_FILES = listOf(
            "index.html",
            "404.html",
            "privacy-policy.html",
            // CSS
            "css/animations.css",
            "css/common.css",
            "css/home.css",
            "css/archive-page.css",
            "css/mobile.css",
            "css/toast.css",
            // JS - Libraries
            "lib/js/jquery.min.js",
            "lib/js/moment.min.js",
            "lib/js/select2.min.js",
            // JS - App modules
            "scripts/main.js",
            "scripts/modules/constants.js",
            "scripts/modules/util.js",
            "scripts/modules/loader.js",
            "scripts/modules/firebase-api.js",
            "scripts/modules/ebird-api.js",
            "scripts/modules/cropper.js",
            "scripts/modules/ui-helpers.js",
            "scripts/modules/public/autocomplete.js",
            "scripts/modules/public/data-helpers.js",
            "scripts/modules/public/filters.js",
            "scripts/modules/public/preview.js",
            "scripts/modules/public/rendering.js",
            "scripts/modules/public/router.js",
            "scripts/modules/public/state.js",
            "scripts/modules/public/ui-helpers.js",
            // Fonts
            "fonts/Calibri.ttf"
        )

        // Icon files served from the website hosting
        private val ICON_FILES = listOf(
            "icons/Blog_Logo.png",
            "icons/about-icon.png",
            "icons/admin-icon.png",
            "icons/appicon.512x512.png",
            "icons/appicon.png",
            "icons/archive-icon.png",
            "icons/background.jpg",
            "icons/bino-icon.png",
            "icons/bird-icon.png",
            "icons/camera-icon-blue.png",
            "icons/camera-icon-yellow.png",
            "icons/close.png",
            "icons/email-icon.png",
            "icons/favicon-16x16.png",
            "icons/favicon-48x48.png",
            "icons/favicon-64x64.png",
            "icons/heart-hollow.png",
            "icons/heart.png",
            "icons/home-icon.png",
            "icons/insect-feed.png",
            "icons/insect-id-app-icon.png",
            "icons/instagram-icon.png",
            "icons/loading.gif",
            "icons/map-icon.png",
            "icons/pause.png",
            "icons/play.png",
            "icons/shuffle.png",
            "icons/telebirding-logo.png",
            "icons/teleinsecta-logo.png",
            "icons/video-icon.png",
            "icons/weather-icons.png"
        )

        // JSON data files served from Firebase Storage
        private val DATA_FILES = listOf(
            "data/bird-sightings.json",
            "data/bird-species.json",
            "data/bird-families.json",
            "data/bird-likes.json",
            "data/insect-sightings.json",
            "data/insect-species.json",
            "data/insect-families.json",
            "data/insect-likes.json",
            "data/places.json",
            "data/stories.json",
            "data/site-data.json"
        )
    }

    private val cacheBaseDir = File(context.filesDir, CACHE_DIR)
    val liveDir = File(cacheBaseDir, LIVE_DIR)
    private val stagingDir = File(cacheBaseDir, STAGING_DIR)

    /** Whether a usable local cache exists */
    val hasCachedSite: Boolean
        get() = File(liveDir, "index.html").exists()

    /**
     * Listener for update progress notifications.
     */
    interface UpdateListener {
        fun onUpdateStarted()
        fun onUpdateProgress(message: String, current: Int, total: Int)
        fun onUpdateComplete(hadUpdates: Boolean)
        fun onUpdateFailed(error: String)
    }

    /**
     * Perform a full update check + download.
     * If the cache is empty (first run), downloads everything.
     * If the cache exists, downloads only deltas.
     *
     * ATOMIC: Only modifies the live cache if ALL downloads succeed.
     *
     * @return true if updates were applied, false if no changes or failed
     */
    suspend fun checkAndUpdate(listener: UpdateListener? = null): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                listener?.onUpdateStarted()

                // Clean up any leftover staging dir from a previous failed attempt
                stagingDir.deleteRecursively()
                stagingDir.mkdirs()

                val isFirstRun = !hasCachedSite

                // Phase 1: Download shell files (HTML, CSS, JS, icons)
                listener?.onUpdateProgress("Downloading app files...", 0, 0)
                val shellResult = downloadShellFiles(isFirstRun)
                if (isFirstRun && !shellResult) {
                    throw Exception("Failed to download shell files on first run")
                }

                // Phase 2: Download data files and check for changes
                listener?.onUpdateProgress("Checking for data updates...", 0, 0)
                val dataResult = downloadDataFiles()

                // Phase 3: Download delta media based on data changes
                val mediaResult = downloadDeltaMedia(listener)

                // ====== ATOMIC COMMIT ======
                // All downloads succeeded — apply staging to live
                if (isFirstRun) {
                    // First run: staging becomes live
                    liveDir.deleteRecursively()
                    stagingDir.renameTo(liveDir)
                    Log.i(TAG, "First run: site cache created.")
                    listener?.onUpdateComplete(true)
                    return@withContext true
                } else if (dataResult.anyChanged || shellResult) {
                    // Subsequent runs: merge staging into live
                    mergeStageIntoLive()
                    Log.i(TAG, "Update applied successfully.")
                    listener?.onUpdateComplete(true)
                    return@withContext true
                } else {
                    // No changes
                    stagingDir.deleteRecursively()
                    Log.i(TAG, "No updates found.")
                    listener?.onUpdateComplete(false)
                    return@withContext false
                }
            } catch (e: Exception) {
                Log.e(TAG, "Update failed, keeping existing cache: ${e.message}", e)
                // Clean up staging — live cache is untouched
                stagingDir.deleteRecursively()
                listener?.onUpdateFailed(e.message ?: "Unknown error")
                return@withContext false
            }
        }
    }

    /**
     * Download shell files (HTML, CSS, JS, icons, fonts) from website hosting.
     * On first run, all files are required.
     * On subsequent runs, this is best-effort (failure is OK).
     *
     * @return true if any files were downloaded or updated
     */
    private fun downloadShellFiles(isFirstRun: Boolean): Boolean {
        var anyDownloaded = false
        val allFiles = SHELL_FILES + ICON_FILES

        for (relativePath in allFiles) {
            val url = "$SITE_BASE_URL/$relativePath"
            val stagingFile = File(stagingDir, relativePath)
            val liveFile = File(liveDir, relativePath)

            try {
                val bytes = downloadUrl(url)
                if (bytes != null) {
                    // Only write if different from live version
                    if (!liveFile.exists() || !liveFile.readBytes().contentEquals(bytes)) {
                        stagingFile.parentFile?.mkdirs()
                        stagingFile.writeBytes(bytes)
                        anyDownloaded = true
                    }
                } else if (isFirstRun) {
                    throw Exception("Required shell file not available: $relativePath")
                }
            } catch (e: Exception) {
                if (isFirstRun) {
                    throw e  // First run: all files are required
                }
                Log.w(TAG, "Shell file download failed (non-critical): $relativePath - ${e.message}")
            }
        }

        return anyDownloaded
    }

    /**
     * Data class to hold data download results
     */
    data class DataResult(val anyChanged: Boolean)

    /**
     * Download JSON data files from Firebase Storage.
     * Compares with live cache to detect changes.
     * ALL data files must download successfully or the entire update is aborted.
     */
    private fun downloadDataFiles(): DataResult {
        var anyChanged = false

        for (dataPath in DATA_FILES) {
            val url = toFirebaseUrl(dataPath)
            val stagingFile = File(stagingDir, dataPath)
            val liveFile = File(liveDir, dataPath)

            val bytes = downloadUrl(url)
                ?: throw Exception("Failed to download data file: $dataPath")

            // Compare with live version
            if (!liveFile.exists() || !liveFile.readBytes().contentEquals(bytes)) {
                anyChanged = true
                Log.i(TAG, "Data changed: $dataPath")
            }

            // Always write to staging (needed for media extraction)
            stagingFile.parentFile?.mkdirs()
            stagingFile.writeBytes(bytes)
        }

        return DataResult(anyChanged)
    }

    /**
     * Download delta media (images/videos) that are in the new data but not in the live cache.
     * ANY failure aborts the entire update.
     */
    private fun downloadDeltaMedia(listener: UpdateListener?): Boolean {
        // Extract media URLs from staged data files
        val newMediaPaths = extractMediaPaths()

        // Find which are not already in the live cache
        val deltaPaths = newMediaPaths.filter { !File(liveDir, it).exists() }

        if (deltaPaths.isEmpty()) {
            Log.i(TAG, "No new media to download.")
            return false
        }

        Log.i(TAG, "${deltaPaths.size} new media files to download.")
        listener?.onUpdateProgress("Downloading ${deltaPaths.size} new media files...", 0, deltaPaths.size)

        for ((index, mediaPath) in deltaPaths.withIndex()) {
            val url = toFirebaseUrl(mediaPath)
            val stagingFile = File(stagingDir, mediaPath)

            val bytes = downloadUrl(url)
                ?: throw Exception("Failed to download media: $mediaPath")

            stagingFile.parentFile?.mkdirs()
            stagingFile.writeBytes(bytes)

            if ((index + 1) % 10 == 0 || index == deltaPaths.size - 1) {
                listener?.onUpdateProgress(
                    "Downloaded ${index + 1}/${deltaPaths.size} files...",
                    index + 1,
                    deltaPaths.size
                )
            }
        }

        return true
    }

    /**
     * Extract all media file paths from the staged JSON data files.
     */
    private fun extractMediaPaths(): Set<String> {
        val paths = mutableSetOf<String>()

        for (dataPath in DATA_FILES) {
            val file = File(stagingDir, dataPath)
            if (!file.exists()) continue

            try {
                val json = JSONObject(file.readText())

                // Sightings files
                if (dataPath.endsWith("-sightings.json") && json.has("sightings")) {
                    val sightings = json.getJSONArray("sightings")
                    for (i in 0 until sightings.length()) {
                        val sighting = sightings.getJSONObject(i)
                        if (sighting.has("media")) {
                            val media = sighting.getJSONArray("media")
                            for (j in 0 until media.length()) {
                                val item = media.getJSONObject(j)
                                addMediaPath(paths, item.optString("src", ""))
                                addMediaPath(paths, item.optString("thumbnail", ""))
                            }
                        }
                    }
                }

                // Site data (featured images)
                if (dataPath == "data/site-data.json" && json.has("featured")) {
                    val featured = json.getJSONArray("featured")
                    for (i in 0 until featured.length()) {
                        val item = featured.getJSONObject(i)
                        addMediaPath(paths, item.optString("src", ""))
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to parse data for media extraction: $dataPath - ${e.message}")
            }
        }

        return paths
    }

    /**
     * Add a media path to the set if it's a relative path (not an external URL).
     */
    private fun addMediaPath(paths: MutableSet<String>, path: String) {
        if (path.isNotBlank() && !path.startsWith("http://") && !path.startsWith("https://") && !path.startsWith("data:")) {
            paths.add(path)
        }
    }

    /**
     * Merge staging directory into live directory.
     * Files in staging overwrite files in live. Files only in live are kept.
     */
    private fun mergeStageIntoLive() {
        stagingDir.walkTopDown().filter { it.isFile }.forEach { stagingFile ->
            val relativePath = stagingFile.relativeTo(stagingDir).path
            val liveFile = File(liveDir, relativePath)
            liveFile.parentFile?.mkdirs()
            stagingFile.copyTo(liveFile, overwrite = true)
        }
        stagingDir.deleteRecursively()
    }

    /**
     * Convert a relative path to a Firebase Storage URL.
     * Matches the encoding used by the website's Util.getData().
     */
    private fun toFirebaseUrl(path: String): String {
        return FIREBASE_STORAGE_BASE + path.replace("/", "%2F") + "?alt=media"
    }

    /**
     * Download a URL and return the bytes, or null on failure.
     */
    private fun downloadUrl(urlString: String): ByteArray? {
        var connection: HttpURLConnection? = null
        try {
            val url = URL(urlString)
            connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 15000
            connection.readTimeout = 30000
            connection.requestMethod = "GET"
            connection.setRequestProperty("Cache-Control", "no-cache")

            if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                Log.w(TAG, "HTTP ${connection.responseCode} for $urlString")
                return null
            }

            return connection.inputStream.readBytes()
        } catch (e: Exception) {
            Log.w(TAG, "Download failed: $urlString - ${e.message}")
            return null
        } finally {
            connection?.disconnect()
        }
    }

    /**
     * Get the MIME type for a file based on its extension.
     */
    fun getMimeType(path: String): String {
        return when {
            path.endsWith(".html") -> "text/html"
            path.endsWith(".css") -> "text/css"
            path.endsWith(".js") -> "application/javascript"
            path.endsWith(".json") -> "application/json"
            path.endsWith(".jpg") || path.endsWith(".jpeg") -> "image/jpeg"
            path.endsWith(".png") -> "image/png"
            path.endsWith(".gif") -> "image/gif"
            path.endsWith(".webp") -> "image/webp"
            path.endsWith(".svg") -> "image/svg+xml"
            path.endsWith(".mp4") -> "video/mp4"
            path.endsWith(".webm") -> "video/webm"
            path.endsWith(".ttf") -> "font/ttf"
            path.endsWith(".woff") -> "font/woff"
            path.endsWith(".woff2") -> "font/woff2"
            else -> "application/octet-stream"
        }
    }
}
