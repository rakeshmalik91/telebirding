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

        private val SHELL_ENTRY_FILES = listOf("index.html", "404.html", "privacy-policy.html")
        private val DATA_ENTRY_FILES = listOf("data/site-data.json", "data/stories.json", "data/places.json")
        private val DATA_TYPES = listOf("sightings", "species", "families", "likes")
        private val MODES = listOf("bird", "insect")


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
                
                // 3. Discover data and shell files dynamically
                val dataFiles = discoverDataFiles()
                val shellFiles = discoverShellFiles()

                // 1. Download HTML, CSS, JS
                val shellResult = downloadSpecifiedFiles(shellFiles, "app files", listener, isFirebase = false)
                Log.i(TAG, "Shell files download complete. Any changed: ${shellResult.anyChanged}, allSuccessful: ${shellResult.allSuccessful}")

                // 2. Download Data JSON files
                val dataResult = downloadSpecifiedFiles(dataFiles, "data files", listener, isFirebase = true)
                Log.i(TAG, "Data files download complete. Any changed: ${dataResult.anyChanged}, allSuccessful: ${dataResult.allSuccessful}")

                val success = shellResult.allSuccessful && dataResult.allSuccessful
                val anyChanged = shellResult.anyChanged || dataResult.anyChanged

                if (!success) {
                    if (isFirstRun) {
                        throw Exception("Failed to download required initial files.")
                    } else {
                        Log.w(TAG, "Failed to download all core files cleanly, aborting update.")
                        stagingDir.deleteRecursively()
                        listener?.onUpdateComplete(false)
                        return@withContext false
                    }
                }

                // Promote Data and Shell to live immediately so the app can start using them
                if (isFirstRun || anyChanged) {
                    commitShell()
                }

                // 3. Download Media files (images)
                val mediaResult = downloadDeltaMedia(dataFiles, listener)

                if (isFirstRun) {
                    liveDir.deleteRecursively()
                    if (!stagingDir.renameTo(liveDir)) {
                        stagingDir.copyRecursively(liveDir, overwrite = true)
                        stagingDir.deleteRecursively()
                    }
                    Log.i(TAG, "First run: site cache commit successful.")
                    listener?.onUpdateComplete(true)
                    return@withContext true
                } else if (anyChanged || mediaResult) {
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

    private fun discoverDataFiles(): List<String> {
        val files = mutableSetOf<String>()
        files.addAll(DATA_ENTRY_FILES)
        MODES.forEach { mode ->
            DATA_TYPES.forEach { Type ->
                files.add("data/$mode-$Type.json")
            }
        }
        return files.toList()
    }

    private fun discoverShellFiles(): List<String> {
        val files = mutableSetOf<String>()
        files.addAll(SHELL_ENTRY_FILES)
        
        // Add known folders for the early committer
        // Actually we will crawl index.html to find actual files
        val indexBytes = downloadUrl("$SITE_BASE_URL/index.html")
        if (indexBytes != null) {
            val html = String(indexBytes)
            
            // Extract CSS
            val cssRegex = """href=["']([^"']+\.css)(?:\?.*)?["']""".toRegex()
            cssRegex.findAll(html).forEach { files.add(it.groupValues[1]) }
            
            // Extract Scripts
            val scriptRegex = """src=["']([^"']+\.js)(?:\?.*)?["']""".toRegex()
            scriptRegex.findAll(html).forEach { files.add(it.groupValues[1]) }
            
            // Extract Icons from html
            val iconRegex = """icons/[^"']+\.(?:png|jpg|jpeg|gif|ico|svg)""".toRegex()
            iconRegex.findAll(html).forEach { files.add(it.value) }
        }

        // Parse main.js for imports
        val mainJsBytes = downloadUrl("$SITE_BASE_URL/scripts/main.js")
        if (mainJsBytes != null) {
            parseJsImports("scripts/main.js", String(mainJsBytes), files)
        }
        
        // Parse constants.js for icons
        val constantsJsBytes = downloadUrl("$SITE_BASE_URL/scripts/modules/constants.js")
        if (constantsJsBytes != null) {
            val js = String(constantsJsBytes)
            val iconRegex = """icons/[^"']+\.(?:png|jpg|jpeg|gif|ico|svg)""".toRegex()
            iconRegex.findAll(js).forEach { files.add(it.value) }
        }

        // Add some fallbacks that might be missed by simple regex
        files.add("fonts/Calibri.ttf")
        files.add("icons/loading.gif")
        
        return files.filter { !it.startsWith("http") }.toList()
    }

    private fun parseJsImports(path: String, content: String, files: MutableSet<String>) {
        val importRegex = """from\s+['"](.+\.js)['"]""".toRegex()
        val dir = path.substringBeforeLast("/", "")
        
        importRegex.findAll(content).forEach { match ->
            var relPath = match.groupValues[1]
            val fullPath = if (relPath.startsWith("/")) {
                relPath.trimStart('/')
            } else if (relPath.startsWith("./")) {
                if (dir.isEmpty()) relPath.substring(2) else "$dir/${relPath.substring(2)}"
            } else if (relPath.startsWith("../")) {
                val parentDir = dir.substringBeforeLast("/", "")
                if (parentDir.isEmpty()) relPath.substring(3) else "$parentDir/${relPath.substring(3)}"
            } else {
                if (dir.isEmpty()) relPath else "$dir/$relPath"
            }
            
            if (files.add(fullPath)) {
                // For a deeper crawl, we could fetch and parse fullPath here,
                // but for this app, one level is likely enough or we can add more entry points.
                val subBytes = downloadUrl("$SITE_BASE_URL/$fullPath")
                if (subBytes != null) {
                    parseJsImports(fullPath, String(subBytes), files)
                }
            }
        }
    }


    private suspend fun downloadSpecifiedFiles(
        allFiles: List<String>, 
        label: String,
        listener: UpdateListener? = null,
        isFirebase: Boolean = false
    ): DownloadResult = coroutineScope {
        val semaphore = Semaphore(MAX_PARALLEL_DOWNLOADS)
        val downloadedCount = AtomicInteger(0)
        
        listener?.onUpdateProgress("Downloading $label...", 0, allFiles.size)

        val deferreds = allFiles.map { relativePath ->
            async {
                semaphore.withPermit {
                    val url = if (isFirebase) toFirebaseUrl(relativePath) else "$SITE_BASE_URL/$relativePath"
                    val stagingFile = File(stagingDir, relativePath)
                    val liveFile = File(liveDir, relativePath)
                    
                    var changed = false
                    var success = true
                    try {
                        val bytes = downloadUrl(url)
                        if (bytes != null) {
                            if (!liveFile.exists() || !liveFile.readBytes().contentEquals(bytes)) {
                                atomicWrite(stagingFile, bytes)
                                changed = true
                            } else {
                                // Even if not changed, write to staging for promote logic
                                atomicWrite(stagingFile, bytes)
                            }
                        } else {
                            Log.w(TAG, "File missing on server: $relativePath")
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "File download fail: $relativePath - ${e.message}")
                        success = false
                    }
                    
                    val current = downloadedCount.incrementAndGet()
                    if (current % 10 == 0 || current == allFiles.size) {
                        listener?.onUpdateProgress("Downloaded $current/${allFiles.size} $label...", current, allFiles.size)
                    }
                    Pair(changed, success)
                }
            }
        }
        
        val results = deferreds.awaitAll()
        val anyChanged = results.any { it.first }
        val allSuccessful = results.all { it.second }
        DownloadResult(anyChanged, allSuccessful)
    }

    data class DownloadResult(val anyChanged: Boolean, val allSuccessful: Boolean)

    private fun commitShell() {
        try {
            stagingDir.walkTopDown().forEach { src ->
                if (src.isFile && src.extension != "tmp") {
                    val relPath = src.relativeTo(stagingDir).path
                    // Skip images for early commit (background download)
                    if (!relPath.startsWith("images/") && !relPath.startsWith("featured-images/")) {
                        val dest = File(liveDir, relPath)
                        dest.parentFile?.mkdirs()
                        src.copyTo(dest, overwrite = true)
                    }
                }
            }
            Log.i(TAG, "Shell files promoted to live.")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to commit shell early: ${e.message}")
        }
    }



    private suspend fun downloadDeltaMedia(dataFiles: List<String>, listener: UpdateListener?): Boolean = coroutineScope {
        val newMediaPaths = extractMediaPaths(stagingDir, dataFiles)

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
                    var mediaDownloaded = false
                    try {
                        val bytes = downloadUrl(url)
                        if (bytes != null) {
                            atomicWrite(stagingFile, bytes)
                            mediaDownloaded = true
                        } else {
                            Log.w(TAG, "Media missing on server: $mediaPath")
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Media download fail: $mediaPath - ${e.message}")
                    }
                    
                    val current = downloadedCount.incrementAndGet()
                    if (current % 10 == 0 || current == deltaPaths.size) {
                        listener?.onUpdateProgress("Downloaded $current/${deltaPaths.size}...", current, deltaPaths.size)
                    }
                    mediaDownloaded
                }
            }
        }
        
        val results = deferreds.awaitAll()
        results.any { it }
    }

    private fun extractMediaPaths(sourceDir: File = stagingDir, dataFiles: List<String>): Set<String> {
        val paths = mutableSetOf<String>()
        val mediaKeys = listOf("src", "image", "thumbnail", "static_map")
        for (dataPath in dataFiles) {

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
        if (path.isBlank() || path.startsWith("data:") || path.contains("featured-images/")) return

        
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
        val referencedPaths = extractMediaPaths(baseDir, discoverDataFiles())
        val dynamicDirs = listOf("images")

        
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

    /**
     * Lazy download a file and save it to the live cache.
     * This is used by the WebView interceptor to handle cache misses on demand.
     */
    fun lazyDownloadAndCache(relativePath: String, isFirebase: Boolean): ByteArray? {
        val url = if (isFirebase) toFirebaseUrl(relativePath) else "$SITE_BASE_URL/$relativePath"
        val file = File(liveDir, relativePath)
        
        val bytes = downloadUrl(url)
        if (bytes != null) {
            try {
                atomicWrite(file, bytes)
                Log.i(TAG, "Lazy load success: $relativePath (${bytes.size} bytes saved to live)")
            } catch (e: Exception) {
                Log.w(TAG, "Failed to save lazy loaded file $relativePath: ${e.message}")
            }
        }
        return bytes
    }

    private fun downloadUrl(urlString: String): ByteArray? {
        var connection: HttpURLConnection? = null
        try {
            val url = URL(urlString)
            connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 15000
            connection.readTimeout = 30000
            val code = connection.responseCode
            return if (code == HttpURLConnection.HTTP_OK) {
                connection.inputStream.readBytes()
            } else if (code == HttpURLConnection.HTTP_NOT_FOUND || code == HttpURLConnection.HTTP_FORBIDDEN) {
                null
            } else {
                throw Exception("HTTP $code")
            }
        } catch (e: Exception) { 
            throw e 
        } finally { 
            connection?.disconnect() 
        }
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
