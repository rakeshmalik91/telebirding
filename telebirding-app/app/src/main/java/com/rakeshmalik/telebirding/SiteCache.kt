package com.rakeshmalik.telebirding

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicInteger
import org.json.JSONObject
import org.json.JSONArray

/**
 * Manages a complete local copy of the telebirding website.
 */
class SiteCache(private val context: Context) {
    private var isBusy = false
    private val busyLock = Any()

    companion object {
        private const val TAG = "SiteCache"
        private const val SITE_BASE_URL = "https://telebirding.info"
        private const val FIREBASE_STORAGE_BASE =
            "https://firebasestorage.googleapis.com/v0/b/telebirding-49623.appspot.com/o/"

        private const val CACHE_DIR = "site-cache"
        private const val LIVE_DIR = "live"
        private const val STAGING_DIR = "staging"
        
        // Number of simultaneous downloads allowed
        private const val MAX_PARALLEL_DOWNLOADS = 25

        private val SHELL_FILES = listOf(
            "index.html", "404.html", "privacy-policy.html",
            "css/animations.css", "css/common.css", "css/home.css", "css/archive-page.css", "css/mobile.css", "css/toast.css",
            "lib/js/jquery.min.js", "lib/js/moment.min.js", "lib/js/select2.min.js",
            "scripts/main.js", "scripts/modules/constants.js", "scripts/modules/util.js", "scripts/modules/loader.js",
            "scripts/modules/firebase-api.js", "scripts/modules/ebird-api.js", "scripts/modules/cropper.js",
            "scripts/modules/ui-helpers.js", "scripts/modules/public/autocomplete.js", "scripts/modules/public/data-helpers.js",
            "scripts/modules/public/filters.js", "scripts/modules/public/preview.js", "scripts/modules/public/rendering.js",
            "scripts/modules/public/router.js", "scripts/modules/public/state.js", "scripts/modules/public/ui-helpers.js",
            "fonts/Calibri.ttf"
        )

        private val ICON_FILES = listOf(
            "icons/Blog_Logo.png", "icons/about-icon.png", "icons/admin-icon.png", "icons/appicon.512x512.png",
            "icons/appicon.png", "icons/archive-icon.png", "icons/background.jpg", "icons/bino-icon.png",
            "icons/bird-icon.png", "icons/camera-icon-blue.png", "icons/camera-icon-yellow.png", "icons/close.png",
            "icons/email-icon.png", "icons/favicon-16x16.png", "icons/favicon-48x48.png", "icons/favicon-64x64.png",
            "icons/heart-hollow.png", "icons/heart.png", "icons/home-icon.png", "icons/insect-feed.png",
            "icons/insect-id-app-icon.png", "icons/instagram-icon.png", "icons/loading.gif", "icons/map-icon.png",
            "icons/pause.png", "icons/play.png", "icons/shuffle.png", "icons/telebirding-logo.png",
            "icons/teleinsecta-logo.png", "icons/video-icon.png", "icons/weather-icons.png"
        )

        private val DATA_FILES = listOf(
            "data/bird-sightings.json", "data/bird-species.json", "data/bird-families.json", "data/bird-likes.json",
            "data/insect-sightings.json", "data/insect-species.json", "data/insect-families.json", "data/insect-likes.json",
            "data/places.json", "data/stories.json", "data/site-data.json"
        )
    }

    private val cacheBaseDir = File(context.filesDir, CACHE_DIR)
    val liveDir = File(cacheBaseDir, LIVE_DIR)
    private val stagingDir = File(cacheBaseDir, STAGING_DIR)

    val hasCachedSite: Boolean
        get() {
            fun checkDir(dir: File): Boolean {
                return File(dir, "index.html").exists() && 
                       File(dir, "css/common.css").exists() && 
                       File(dir, "scripts/main.js").exists()
            }
            
            val exists = checkDir(liveDir) || checkDir(stagingDir)
            if (!exists) {
                Log.i(TAG, "Site not present in live or staging.")
            }
            return exists
        }

    interface UpdateListener {
        fun onUpdateStarted()
        fun onUpdateProgress(message: String, current: Int, total: Int)
        fun onUpdateComplete(hadUpdates: Boolean)
        fun onUpdateFailed(error: String)
    }

    suspend fun checkAndUpdate(listener: UpdateListener? = null): Boolean {
        synchronized(busyLock) {
            if (isBusy) {
                Log.i(TAG, "Update already in progress, skipping concurrent request.")
                return false
            }
            isBusy = true
        }

        return withContext(Dispatchers.IO) {
            val isFirstRun = !hasCachedSite
            try {
                listener?.onUpdateStarted()

                if (!stagingDir.exists()) {
                    stagingDir.mkdirs()
                } else {
                    stagingDir.walkTopDown().filter { it.extension == "tmp" }.forEach { it.delete() }
                }

                listener?.onUpdateProgress("Downloading app files...", 0, 0)
                val shellResult = downloadShellFiles(isFirstRun)
                if (isFirstRun && !shellResult && !hasCachedSite) {
                    throw Exception("Failed to download shell files on first run")
                }

                if (isFirstRun && shellResult) {
                    commitShell()
                }

                val dataResult = downloadDataFiles()
                val mediaResult = downloadDeltaMedia(listener)

                if (isFirstRun) {
                    liveDir.deleteRecursively()
                    if (!stagingDir.renameTo(liveDir)) {
                        stagingDir.copyRecursively(liveDir, overwrite = true)
                        stagingDir.deleteRecursively()
                    }
                    Log.i(TAG, "First run: site cache commit successful.")
                    listener?.onUpdateComplete(true)
                    return@withContext true
                } else if (dataResult.anyChanged || shellResult || mediaResult) {
                    mergeStageIntoLive()
                    cleanupOrphanedMedia(liveDir)
                    Log.i(TAG, "Update applied successfully.")
                    listener?.onUpdateComplete(true)
                    return@withContext true
                } else {
                    stagingDir.deleteRecursively()
                    Log.i(TAG, "No updates found.")
                    listener?.onUpdateComplete(false)
                    return@withContext false
                }
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                Log.e(TAG, "Update failed: ${e.message}", e)
                listener?.onUpdateFailed(e.message ?: "Unknown error")
                return@withContext false
            } finally {
                synchronized(busyLock) {
                    isBusy = false
                }
            }
        }
    }

    private suspend fun downloadShellFiles(isFirstRun: Boolean): Boolean = coroutineScope {
        var anyDownloaded = false
        val allFiles = SHELL_FILES + ICON_FILES
        val semaphore = Semaphore(MAX_PARALLEL_DOWNLOADS)
        
        val deferreds = allFiles.map { relativePath ->
            async {
                semaphore.withPermit {
                    val url = "$SITE_BASE_URL/$relativePath"
                    val stagingFile = File(stagingDir, relativePath)
                    val liveFile = File(liveDir, relativePath)
                    try {
                        val bytes = downloadUrl(url)
                        if (bytes != null) {
                            if (!liveFile.exists() || !liveFile.readBytes().contentEquals(bytes)) {
                                atomicWrite(stagingFile, bytes)
                                true
                            } else false
                        } else if (isFirstRun) {
                            throw Exception("Required file missing: $relativePath")
                        } else false
                    } catch (e: Exception) {
                        if (isFirstRun) throw e
                        Log.w(TAG, "Minor file fail: $relativePath - ${e.message}")
                        false
                    }
                }
            }
        }
        
        deferreds.awaitAll().any { it }.also { anyDownloaded = it }
        anyDownloaded
    }

    private fun commitShell() {
        val shellDirs = listOf("css", "scripts", "lib", "icons", "fonts")
        val shellFiles = listOf("index.html", "404.html", "privacy-policy.html")
        
        try {
            shellFiles.forEach { name ->
                val src = File(stagingDir, name)
                if (src.exists()) {
                    val dest = File(liveDir, name)
                    dest.parentFile?.mkdirs()
                    src.copyTo(dest, overwrite = true)
                }
            }
            shellDirs.forEach { name ->
                val src = File(stagingDir, name)
                if (src.exists()) {
                    val dest = File(liveDir, name)
                    src.copyRecursively(dest, overwrite = true)
                }
            }
            Log.i(TAG, "Shell files promoted to live.")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to commit shell early: ${e.message}")
        }
    }

    data class DataResult(val anyChanged: Boolean)

    private suspend fun downloadDataFiles(): DataResult = coroutineScope {
        var anyChanged = false
        val semaphore = Semaphore(MAX_PARALLEL_DOWNLOADS)
        
        val deferreds = DATA_FILES.map { dataPath ->
            async {
                semaphore.withPermit {
                    val url = toFirebaseUrl(dataPath)
                    val stagingFile = File(stagingDir, dataPath)
                    val liveFile = File(liveDir, dataPath)
                    val bytes = downloadUrl(url) ?: throw Exception("Failed data: $dataPath")
                    val changed = if (!liveFile.exists() || !liveFile.readBytes().contentEquals(bytes)) {
                        true
                    } else false
                    atomicWrite(stagingFile, bytes)
                    changed
                }
            }
        }
        
        anyChanged = deferreds.awaitAll().any { it }
        DataResult(anyChanged)
    }

    private suspend fun downloadDeltaMedia(listener: UpdateListener?): Boolean = coroutineScope {
        val newMediaPaths = extractMediaPaths()
        val deltaPaths = newMediaPaths.filter { !File(liveDir, it).exists() && !File(stagingDir, it).exists() }
        if (deltaPaths.isEmpty()) return@coroutineScope false

        Log.i(TAG, "${deltaPaths.size} new media files to download.")
        listener?.onUpdateProgress("Downloading ${deltaPaths.size} media files...", 0, deltaPaths.size)

        val semaphore = Semaphore(MAX_PARALLEL_DOWNLOADS)
        val downloadedCount = AtomicInteger(0)
        
        val deferreds = deltaPaths.map { mediaPath ->
            async {
                semaphore.withPermit {
                    val url = toFirebaseUrl(mediaPath)
                    val stagingFile = File(stagingDir, mediaPath)
                    val bytes = downloadUrl(url) ?: throw Exception("Failed media: $mediaPath")
                    atomicWrite(stagingFile, bytes)
                    
                    val current = downloadedCount.incrementAndGet()
                    if (current % 10 == 0 || current == deltaPaths.size) {
                        listener?.onUpdateProgress("Downloaded $current/${deltaPaths.size}...", current, deltaPaths.size)
                    }
                }
            }
        }
        
        deferreds.awaitAll()
        true
    }

    private fun extractMediaPaths(sourceDir: File = stagingDir): Set<String> {
        val paths = mutableSetOf<String>()
        val mediaKeys = listOf("src", "image", "thumbnail", "static_map")
        for (dataPath in DATA_FILES) {
            val file = File(sourceDir, dataPath)
            if (!file.exists()) continue
            try {
                val content = file.readText()
                if (content.startsWith("{")) findMediaInObject(JSONObject(content), mediaKeys, paths)
                else if (content.startsWith("[")) findMediaInArray(JSONArray(content), mediaKeys, paths)
            } catch (e: Exception) { }
        }
        return paths
    }

    private fun findMediaInObject(obj: JSONObject, keys: List<String>, paths: MutableSet<String>) {
        val iter = obj.keys()
        while (iter.hasNext()) {
            val key = iter.next()
            if (keys.contains(key)) addMediaPath(paths, obj.optString(key, ""))
            val subObj = obj.optJSONObject(key)
            if (subObj != null) findMediaInObject(subObj, keys, paths)
            val subArr = obj.optJSONArray(key)
            if (subArr != null) findMediaInArray(subArr, keys, paths)
        }
    }

    private fun findMediaInArray(arr: JSONArray, keys: List<String>, paths: MutableSet<String>) {
        for (i in 0 until arr.length()) {
            val subObj = arr.optJSONObject(i)
            if (subObj != null) findMediaInObject(subObj, keys, paths)
            val subArr = arr.optJSONArray(i)
            if (subArr != null) findMediaInArray(subArr, keys, paths)
            val str = arr.optString(i)
            if (str != null && (str.endsWith(".jpg") || str.endsWith(".png") || str.endsWith(".mp4"))) addMediaPath(paths, str)
        }
    }

    private fun addMediaPath(paths: MutableSet<String>, path: String) {
        if (path.isBlank() || path.startsWith("data:")) return
        
        if (path.startsWith("http")) {
            // If it's a Firebase Storage URL for our bucket, extract the relative path
            if (path.contains(FIREBASE_STORAGE_BASE)) {
                try {
                    val afterPrefix = path.substring(path.indexOf(FIREBASE_STORAGE_BASE) + FIREBASE_STORAGE_BASE.length)
                    val encodedPath = afterPrefix.split("?")[0]
                    val decodedPath = java.net.URLDecoder.decode(encodedPath, "UTF-8")
                    paths.add(decodedPath.trimStart('/'))
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to decode Firebase URL: $path")
                }
            }
        } else {
            paths.add(path.trimStart('/'))
        }
    }

    private fun cleanupOrphanedMedia(baseDir: File) {
        Log.i(TAG, "Starting local media cleanup...")
        val referencedPaths = extractMediaPaths(baseDir)
        val dynamicDirs = listOf("images", "featured-images")
        
        dynamicDirs.forEach { dirName ->
            val dir = File(baseDir, dirName)
            if (dir.exists() && dir.isDirectory) {
                dir.walkTopDown().forEach { file ->
                    if (file.isFile) {
                        val relPath = file.relativeTo(baseDir).path.replace('\\', '/')
                        if (!referencedPaths.contains(relPath)) {
                            Log.i(TAG, "Cleanup: deleting unused file $relPath")
                            file.delete()
                        }
                    }
                }
            }
        }
        Log.i(TAG, "Local media cleanup complete.")
    }

    private fun mergeStageIntoLive() {
        stagingDir.walkTopDown().filter { it.isFile && it.extension != "tmp" }.forEach {
            val rel = it.relativeTo(stagingDir).path
            val live = File(liveDir, rel)
            live.parentFile?.mkdirs()
            it.copyTo(live, overwrite = true)
        }
        stagingDir.deleteRecursively()
    }

    private fun atomicWrite(file: File, bytes: ByteArray) {
        val tmp = File(file.parentFile, file.name + ".tmp")
        file.parentFile?.mkdirs()
        tmp.writeBytes(bytes)
        if (!tmp.renameTo(file)) {
            tmp.copyTo(file, overwrite = true)
            tmp.delete()
        }
    }

    private fun toFirebaseUrl(path: String) = FIREBASE_STORAGE_BASE + path.replace("/", "%2F") + "?alt=media"

    private fun downloadUrl(urlString: String): ByteArray? {
        var connection: HttpURLConnection? = null
        return try {
            val url = URL(urlString)
            connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 15000
            connection.readTimeout = 30000
            if (connection.responseCode == HttpURLConnection.HTTP_OK) connection.inputStream.readBytes() else null
        } catch (e: Exception) { null } finally { connection?.disconnect() }
    }

    fun getMimeType(path: String): String = when {
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
