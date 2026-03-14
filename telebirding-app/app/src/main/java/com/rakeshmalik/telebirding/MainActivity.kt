package com.rakeshmalik.telebirding

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.os.Message
import android.util.AttributeSet
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

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

/**
 * A custom SwipeRefreshLayout that can be told by Javascript whether a nested scrollable
 * element is being touched and can be scrolled up.
 */
class CustomSwipeRefreshLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : SwipeRefreshLayout(context, attrs) {

    @Volatile
    var nestedCanScrollUp = false
    private var webView: WebView? = null

    fun setWebView(webView: WebView) {
        this.webView = webView
    }

    override fun canChildScrollUp(): Boolean {
        // If JS tells us the nested element can scroll, we return true to prevent refresh.
        if (nestedCanScrollUp) {
            return true
        }
        // Otherwise, fall back to the default behavior of checking the WebView's scroll position.
        return webView?.scrollY ?: 0 > 0
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
    var swipeRefreshLayout by remember { mutableStateOf<CustomSwipeRefreshLayout?>(null) }


    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF111B26)) // Header color - extends behind status bar
    ) {
        AndroidView(
            factory = { context ->
                val siteCache = SiteCache(context)
                val cachedClient = CachedWebViewClient(siteCache)

                val webView = object : WebView(context) {
                    override fun onScrollChanged(l: Int, t: Int, oldl: Int, oldt: Int) {
                        super.onScrollChanged(l, t, oldl, oldt)
                        scrollY.value = t
                    }
                }
                webViewForScrolling = webView
                val localSwipeRefreshLayout = CustomSwipeRefreshLayout(context).apply {
                    setWebView(webView)
                    addView(webView)
                    setOnRefreshListener {
                        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                        val activeNetwork = connectivityManager.activeNetwork
                        val networkCapabilities = connectivityManager.getNetworkCapabilities(activeNetwork)
                        val isConnected = networkCapabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true

                        if (isConnected) {
                            // On pull-to-refresh: trigger background update, then reload
                            CoroutineScope(Dispatchers.Main).launch {
                                siteCache.checkAndUpdate(object : SiteCache.UpdateListener {
                                    override fun onUpdateStarted() {
                                        Log.i("MainActivity", "Pull-to-refresh: update started")
                                    }
                                    override fun onUpdateProgress(message: String, current: Int, total: Int) {
                                        Log.i("MainActivity", "Pull-to-refresh: $message")
                                    }
                                    override fun onUpdateComplete(hadUpdates: Boolean) {
                                        Log.i("MainActivity", "Pull-to-refresh: update complete (hadUpdates=$hadUpdates)")
                                        webView.post { webView.reload() }
                                    }
                                    override fun onUpdateFailed(error: String) {
                                        Log.w("MainActivity", "Pull-to-refresh: update failed: $error")
                                        // Still reload — will serve from existing cache
                                        webView.post { webView.reload() }
                                    }
                                })
                            }
                        } else {
                            isRefreshing = false
                        }
                    }
                }
                swipeRefreshLayout = localSwipeRefreshLayout

                webView.apply {
                    webChromeClient = object : WebChromeClient() {
                        override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                            val newWebView = WebView(view.context)
                            newWebView.webViewClient = object : WebViewClient() {
                                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                                    val browserIntent = Intent(Intent.ACTION_VIEW, request.url)
                                    context.startActivity(browserIntent)
                                    return true
                                }
                            }
                            (resultMsg.obj as WebView.WebViewTransport).webView = newWebView
                            resultMsg.sendToTarget()
                            return true
                        }
                    }
                    webViewClient = object : WebViewClient() {
                        override fun shouldInterceptRequest(
                            view: WebView?,
                            request: WebResourceRequest?
                        ): WebResourceResponse? {
                            // Let the cache intercept requests it can serve
                            val cached = request?.let { cachedClient.shouldInterceptRequest(it) }
                            if (cached != null) return cached
                            
                            return super.shouldInterceptRequest(view, request)
                        }

                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            swipeRefreshLayout?.isRefreshing = false
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

                            // Inject JS to handle nested scrolling
                            view?.evaluateJavascript("""
                                (function() {
                                    var scrollableElement = null;

                                    // Find the first scrollable parent of an element
                                    function findScrollableElement(element) {
                                        if (!element || element === document.body || element === document.documentElement) {
                                            return null;
                                        }
                                        const style = window.getComputedStyle(element);
                                        const isOverFlowYScroll = style.overflowY === 'scroll' || style.overflowY === 'auto';
                                        if (isOverFlowYScroll && element.scrollHeight > element.clientHeight) {
                                            return element;
                                        }
                                        return findScrollableElement(element.parentElement);
                                    }

                                    // Check the state of the scrollable element and notify Android
                                    function updateScrollState() {
                                        let canScroll = false;
                                        if (scrollableElement && scrollableElement.scrollTop > 0) {
                                            canScroll = true;
                                        }
                                        if (window.Android && window.Android.setNestedCanScrollUp) {
                                            window.Android.setNestedCanScrollUp(canScroll);
                                        }
                                    }

                                    // On touch start, find the scrollable element
                                    document.body.addEventListener('touchstart', function(event) {
                                        scrollableElement = findScrollableElement(event.target);
                                        updateScrollState(); // Initial check
                                    }, { passive: true });

                                    // As the user moves their finger, continuously update the scroll state
                                    document.body.addEventListener('touchmove', function() {
                                        if (scrollableElement) {
                                            updateScrollState();
                                        }
                                    }, { passive: true });

                                    // When the touch ends, reset everything
                                    const endTouch = () => {
                                        if (scrollableElement) {
                                            if (window.Android && window.Android.setNestedCanScrollUp) {
                                                window.Android.setNestedCanScrollUp(false);
                                            }
                                            scrollableElement = null;
                                        }
                                    };

                                    document.body.addEventListener('touchend', endTouch, { passive: true });
                                    document.body.addEventListener('touchcancel', endTouch, { passive: true });
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
                                // If we have a cached site, load from there instead of showing offline page
                                if (siteCache.hasCachedSite) {
                                    view?.loadUrl("https://telebirding.info/?page=f")
                                } else {
                                    lastFailedUrl = request.url.toString()
                                    view?.loadUrl("file:///android_asset/offline.html")
                                }
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
                        setSupportMultipleWindows(true)
                        javaScriptCanOpenWindowsAutomatically = true
                        mediaPlaybackRequiresUserGesture = false
                        allowFileAccess = true
                        allowContentAccess = true
                        userAgentString = "Mozilla/5.0 (Linux; Android ${Build.VERSION.RELEASE}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                        textZoom = 100
                        // Use default cache mode — our interceptor handles serving from local cache
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

                            @JavascriptInterface
                            fun setNestedCanScrollUp(canScroll: Boolean) {
                                swipeRefreshLayout?.nestedCanScrollUp = canScroll
                            }
                        },
                        "Android"
                    )

                    // Load the site URL — the interceptor will serve from cache if available
                    loadUrl("https://telebirding.info/?page=f")

                    // Trigger background update check
                    CoroutineScope(Dispatchers.Main).launch {
                        siteCache.checkAndUpdate(object : SiteCache.UpdateListener {
                            override fun onUpdateStarted() {
                                Log.i("MainActivity", "Startup: update check started")
                            }
                            override fun onUpdateProgress(message: String, current: Int, total: Int) {
                                Log.i("MainActivity", "Startup: $message")
                            }
                            override fun onUpdateComplete(hadUpdates: Boolean) {
                                Log.i("MainActivity", "Startup: update complete (hadUpdates=$hadUpdates)")
                                if (hadUpdates) {
                                    // Silently reload to show updated content
                                    this@apply.post { reload() }
                                }
                            }
                            override fun onUpdateFailed(error: String) {
                                Log.w("MainActivity", "Startup: update failed: $error")
                                // No action needed — site works from existing cache
                            }
                        })
                    }

                    onWebViewCreated(this)
                }

                localSwipeRefreshLayout
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
