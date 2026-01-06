package com.rakeshmalik.telebirding

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
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
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.FloatingActionButton
import androidx.compose.material.Icon
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
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

@Composable
fun WebViewScreen(onWebViewCreated: (WebView) -> Unit) {
    var lastFailedUrl by remember { mutableStateOf<String?>(null) }
    val scrollY = remember { mutableStateOf(0) }
    val showButton by remember {
        derivedStateOf {
            scrollY.value > 2500  // Show button after scrolling down
        }
    }
    var webViewForScrolling by remember { mutableStateOf<WebView?>(null) }


    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF111B26)) // Header color - extends behind status bar
    ) {
        AndroidView(
            factory = { context ->
                val webView = object : WebView(context) {
                    override fun onScrollChanged(l: Int, t: Int, oldl: Int, oldt: Int) {
                        super.onScrollChanged(l, t, oldl, oldt)
                        scrollY.value = t
                    }
                }
                webViewForScrolling = webView
                val swipeRefreshLayout = SwipeRefreshLayout(context).apply {
                    addView(webView)
                    setOnRefreshListener {
                        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                        val activeNetwork = connectivityManager.activeNetwork
                        val networkCapabilities = connectivityManager.getNetworkCapabilities(activeNetwork)
                        val isConnected = networkCapabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true

                        if (isConnected) {
                            webView.clearCache(true)
                            webView.reload()
                        } else {
                            isRefreshing = false
                        }
                    }
                }

                webView.apply {
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            swipeRefreshLayout.isRefreshing = false
                            // Ensure the viewport is set correctly for mobile devices.
                            view?.evaluateJavascript("""
                                (function() {
                                    var viewport = document.querySelector('meta[name="viewport"]');
                                    if (!viewport) {
                                        viewport = document.createElement('meta');
                                        viewport.setAttribute('name', 'viewport');
                                        document.head.appendChild(viewport);
                                    }
                                    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=yes, viewport-fit=cover');
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
                        builtInZoomControls = true
                        displayZoomControls = false
                        setSupportZoom(true)
                        javaScriptCanOpenWindowsAutomatically = true
                        mediaPlaybackRequiresUserGesture = false
                        allowFileAccess = true
                        allowContentAccess = true
                        userAgentString = "Mozilla/5.0 (Linux; Android ${Build.VERSION.RELEASE}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                        textZoom = 100
                        cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
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
                }

                swipeRefreshLayout
            },
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.statusBars) // Add padding to start below status bar
        )

        AnimatedVisibility(
            visible = showButton,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp),
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            FloatingActionButton(
                onClick = {
                    webViewForScrolling?.scrollTo(0, 0)
                },
            ) {
                Icon(Icons.Filled.ArrowUpward, contentDescription = "Scroll to top")
            }
        }
    }
}