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
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.FloatingActionButton
import androidx.compose.material.Icon
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.LinearProgressIndicator
import androidx.compose.material.CircularProgressIndicator
import androidx.compose.material.Text
import androidx.compose.material.TextButton
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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

    // Update progress state
    var isUpdating by remember { mutableStateOf(false) }
    var showUpdateOverlay by remember { mutableStateOf(false) }
    var forceHideHUD by remember { mutableStateOf(false) }
    var isStartupUpdate by remember { mutableStateOf(false) }
    var isFirstLoadComplete by remember { mutableStateOf(false) }
    var updateMessage by remember { mutableStateOf("") }
    var updateProgress by remember { mutableStateOf(0f) } // 0.0 to 1.0


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
                    init {
                        // Set dark background to avoid white flash while loading
                        setBackgroundColor(0xFF1F2B39.toInt())
                    }
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
                            // If already updating in background (e.g. startup), just show the HUD
                            if (isUpdating) {
                                showUpdateOverlay = true
                                forceHideHUD = false 
                                this@apply.isRefreshing = false
                                return@setOnRefreshListener
                            }

                            // On pull-to-refresh: trigger background update, then reload
                            CoroutineScope(Dispatchers.Main).launch {
                                siteCache.checkAndUpdate(object : SiteCache.UpdateListener {
                                    override fun onUpdateStarted() {
                                        Log.i("MainActivity", "Pull-to-refresh: update started")
                                        isUpdating = true
                                        isStartupUpdate = false
                                        showUpdateOverlay = true
                                        forceHideHUD = false 
                                        updateMessage = "Starting update..."
                                        updateProgress = 0f
                                    }
                                    override fun onUpdateProgress(message: String, current: Int, total: Int) {
                                        Log.i("MainActivity", "Pull-to-refresh: $message")
                                        updateMessage = message
                                        if (total > 0) {
                                            updateProgress = current.toFloat() / total.toFloat()
                                        } else {
                                            updateProgress = 0f
                                        }
                                    }
                                    override fun onUpdateComplete(hadUpdates: Boolean) {
                                        Log.i("MainActivity", "Pull-to-refresh: update complete (hadUpdates=$hadUpdates)")
                                        isUpdating = false
                                        webView.post { webView.reload() }
                                    }
                                    override fun onUpdateFailed(error: String) {
                                        Log.w("MainActivity", "Pull-to-refresh: update failed: $error")
                                        isUpdating = false
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

                        override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                            super.onPageStarted(view, url, favicon)
                            // Override Firebase early
                            view?.evaluateJavascript("window.FIREBASE_ENABLED = false;", null)
                        }

                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            swipeRefreshLayout?.isRefreshing = false
                            isFirstLoadComplete = true

                            // Auto-collapse HUD on startup
                            if (isStartupUpdate && siteCache.hasCachedSite) {
                                showUpdateOverlay = false
                            }

                            // Force override Firebase to false for local mode
                            view?.evaluateJavascript("window.FIREBASE_ENABLED = false;", null)

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
                                isUpdating = true
                                isStartupUpdate = true
                                
                                // Only show HUD on startup if we have NOTHING to show (first run).
                                // If we have a cache, let the user see the local content immediately.
                                showUpdateOverlay = !siteCache.hasCachedSite
                                
                                forceHideHUD = false
                                updateMessage = "Checking for updates..."
                                updateProgress = 0f
                            }
                            override fun onUpdateProgress(message: String, current: Int, total: Int) {
                                Log.i("MainActivity", "Startup: $message")
                                updateMessage = message
                                if (total > 0) {
                                    updateProgress = current.toFloat() / total.toFloat()
                                } else {
                                    updateProgress = 0f
                                }
                            }
                            override fun onUpdateComplete(hadUpdates: Boolean) {
                                Log.i("MainActivity", "Startup: update complete (hadUpdates=$hadUpdates)")
                                isUpdating = false
                                if (hadUpdates) {
                                    // Silently reload to show updated content
                                    this@apply.post { reload() }
                                }
                            }
                            override fun onUpdateFailed(error: String) {
                                Log.w("MainActivity", "Startup: update failed: $error")
                                isUpdating = false
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

        // Update Progress Overlay
        if (isUpdating) {
            if (showUpdateOverlay) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.5f)),
                    contentAlignment = Alignment.Center
                ) {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color(0xFF1F2B39),
                        elevation = 8.dp
                    ) {
                        Column(
                            modifier = Modifier
                                .padding(24.dp)
                                .width(280.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(48.dp),
                                color = Color(0xFF00BFA5),
                                strokeWidth = 4.dp
                            )
                            Spacer(modifier = Modifier.height(20.dp))
                            Text(
                                text = "Updating Site Data",
                                color = Color.White,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = updateMessage,
                                color = Color.White.copy(alpha = 0.7f),
                                fontSize = 14.sp
                            )
                            
                            if (updateProgress > 0) {
                                Spacer(modifier = Modifier.height(16.dp))
                                LinearProgressIndicator(
                                    progress = updateProgress,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(4.dp),
                                    color = Color(0xFF00BFA5),
                                    backgroundColor = Color.White.copy(alpha = 0.1f)
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "${(updateProgress * 100).toInt()}%",
                                    color = Color.White.copy(alpha = 0.5f),
                                    fontSize = 12.sp
                                )
                            }

                            Spacer(modifier = Modifier.height(16.dp))
                            TextButton(
                                onClick = { 
                                    showUpdateOverlay = false 
                                    forceHideHUD = true
                                    // Also hide the native SwipeRefreshLayout spinner immediately
                                    swipeRefreshLayout?.isRefreshing = false
                                }
                            ) {
                                Text(
                                    text = "Run in Background",
                                    color = Color(0xFF00BFA5),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            } else if (!forceHideHUD) {
                // Background Indicator: Small spinner at the bottom right
                Surface(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(bottom = if (showButton) 80.dp else 16.dp, end = 16.dp)
                        .clickable { 
                            showUpdateOverlay = true
                            forceHideHUD = false 
                        },
                    shape = RoundedCornerShape(20.dp),
                    color = Color(0xFF1F2B39).copy(alpha = 0.9f),
                    elevation = 4.dp
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = Color(0xFF00BFA5),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (updateProgress > 0) "${(updateProgress * 100).toInt()}% Updating..." else "Updating...",
                            color = Color.White,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}
