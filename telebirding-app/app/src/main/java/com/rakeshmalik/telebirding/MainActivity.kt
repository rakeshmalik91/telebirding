package com.rakeshmalik.telebirding

import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import com.rakeshmalik.telebirding.ui.theme.TelebirdingTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TelebirdingTheme {
                var webView by remember { mutableStateOf<WebView?>(null) }

                BackHandler {
                    if (webView?.canGoBack() == true) {
                        webView?.goBack()
                    } else {
                        // Exit app if no history
                        finish()
                    }
                }

                WebViewScreen { webView = it }
            }
        }
    }
}

@OptIn(ExperimentalMaterialApi::class)
@Composable
fun WebViewScreen(onWebViewCreated: (WebView) -> Unit) {
    var lastFailedUrl by remember { mutableStateOf<String?>(null) }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var isRefreshing by remember { mutableStateOf(false) }

    val pullRefreshState = rememberPullRefreshState(refreshing = isRefreshing, onRefresh = {
        webView?.let {
            isRefreshing = true
            it.clearCache(true)
            it.reload()
        }
    })

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF111B26)) // Header color - extends behind status bar
            .pullRefresh(pullRefreshState)
    ) {
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            isRefreshing = false
                            // Ensure the viewport is set correctly for mobile devices.
                            view?.evaluateJavascript("""
                                (function() {
                                    var viewport = document.querySelector('meta[name="viewport"]');
                                    if (!viewport) {
                                        viewport = document.createElement('meta');
                                        viewport.setAttribute('name', 'viewport');
                                        document.head.appendChild(viewport);
                                    }
                                    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
                                })();
                            """.trimIndent(), null)
                        }

                        override fun onReceivedError(
                            view: WebView?,
                            request: WebResourceRequest?,
                            error: WebResourceError?
                        ) {
                            super.onReceivedError(view, request, error)
                            if (error?.errorCode == ERROR_HOST_LOOKUP && request?.isForMainFrame == true) {
                                lastFailedUrl = request.url.toString()
                                view?.loadUrl("file:///android_asset/offline.html")
                            }
                        }
                    }
                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        useWideViewPort = true
                        loadWithOverviewMode = false
                        builtInZoomControls = false
                        displayZoomControls = false
                        setSupportZoom(false)
                        javaScriptCanOpenWindowsAutomatically = true
                        mediaPlaybackRequiresUserGesture = false
                        allowFileAccess = true
                        allowContentAccess = true
                        userAgentString = "Mozilla/5.0 (Linux; Android ${Build.VERSION.RELEASE}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                        textZoom = 100
                        cacheMode = WebSettings.LOAD_DEFAULT
                    }
                    addJavascriptInterface(
                        object {
                            @JavascriptInterface
                            fun reloadPage() {
                                lastFailedUrl?.let {
                                    this@apply.post { loadUrl(it) }
                                }
                            }
                        },
                        "Android"
                    )
                    loadUrl("https://telebirding.info/?page=f")
                    onWebViewCreated(this)
                    webView = this
                }
            },
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.statusBars) // Add padding to start below status bar
        )

        PullRefreshIndicator(
            refreshing = isRefreshing,
            state = pullRefreshState,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .windowInsetsPadding(WindowInsets.statusBars)
        )
    }
}
