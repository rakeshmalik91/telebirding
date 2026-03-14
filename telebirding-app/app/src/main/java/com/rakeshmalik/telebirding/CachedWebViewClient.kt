package com.rakeshmalik.telebirding

import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.File

/**
 * A WebViewClient that intercepts requests for telebirding.info and Firebase Storage
 * and serves them from the local SiteCache instead of making network requests.
 */
class CachedWebViewClient(private val siteCache: SiteCache) {

    companion object {
        private const val TAG = "CachedWebViewClient"
        private const val SITE_HOST = "telebirding.info"
        private const val FIREBASE_STORAGE_HOST = "firebasestorage.googleapis.com"
        private const val FIREBASE_STORAGE_PATH_PREFIX = "/v0/b/telebirding-49623.appspot.com/o/"
    }

    /**
     * Intercept a web resource request and serve from local cache if available.
     */
    fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? {
        val url = request.url ?: return null
        val urlString = url.toString()

        if (request.method != "GET") return null

        val host = url.host ?: return null
        if (host.contains("youtube.com") || host.contains("ytimg.com") ||
            host.contains("ebird.org") || host.contains("gstatic.com") ||
            host.contains("google.com") || host.contains("instagram.com")
        ) {
            return null
        }

        if (host == SITE_HOST || host == "www.$SITE_HOST") {
            return serveFromCache(url.path?.trimStart('/') ?: "index.html")
        }

        if (host == FIREBASE_STORAGE_HOST && url.path?.startsWith(FIREBASE_STORAGE_PATH_PREFIX) == true) {
            return serveFirebaseStorageFromCache(urlString)
        }

        return null
    }

    private fun serveFromCache(relativePath: String): WebResourceResponse? {
        val path = if (relativePath.isEmpty() || relativePath == "/") "index.html" else relativePath
        val cleanPath = path.split("?")[0]

        val file = File(siteCache.liveDir, cleanPath)
        if (!file.exists() || !file.isFile) {
            Log.d(TAG, "Cache miss (hosting): $cleanPath")
            return null
        }

        Log.d(TAG, "Cache hit (hosting): $cleanPath")
        val mimeType = siteCache.getMimeType(cleanPath)
        return WebResourceResponse(
            mimeType,
            "UTF-8",
            200,
            "OK",
            mapOf(
                "Access-Control-Allow-Origin" to "*",
                "Cache-Control" to "no-cache"
            ),
            ByteArrayInputStream(file.readBytes())
        )
    }

    private fun serveFirebaseStorageFromCache(urlString: String): WebResourceResponse? {
        val pathStart = urlString.indexOf(FIREBASE_STORAGE_PATH_PREFIX)
        if (pathStart < 0) return null

        val afterPrefix = urlString.substring(pathStart + FIREBASE_STORAGE_PATH_PREFIX.length)
        val encodedPath = afterPrefix.split("?")[0]
        val relativePath = java.net.URLDecoder.decode(encodedPath, "UTF-8")

        val file = File(siteCache.liveDir, relativePath)
        if (!file.exists() || !file.isFile) {
            Log.d(TAG, "Cache miss (Firebase): $relativePath")
            return null
        }

        Log.d(TAG, "Cache hit (Firebase): $relativePath")
        val mimeType = siteCache.getMimeType(relativePath)
        return WebResourceResponse(
            mimeType,
            null,
            200,
            "OK",
            mapOf(
                "Access-Control-Allow-Origin" to "*",
                "Cache-Control" to "no-cache"
            ),
            ByteArrayInputStream(file.readBytes())
        )
    }
}
