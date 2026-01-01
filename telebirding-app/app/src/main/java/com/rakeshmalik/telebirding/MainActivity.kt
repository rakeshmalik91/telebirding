package com.rakeshmalik.telebirding

import android.os.Build
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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

@Composable
fun WebViewScreen(onWebViewCreated: (WebView) -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF111B26)) // Header color - extends behind status bar
    ) {
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
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
                    }
                    clearCache(true)
                    loadUrl("https://telebirding.info/?page=f")
                    onWebViewCreated(this)
                }
            },
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.statusBars) // Add padding to start below status bar
        )
    }
}
