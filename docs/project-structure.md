# Telebirding Project Architecture & Layout

This document provides an actionable directory and architecture guide for the Telebirding repository.

---

## 🎯 Quick Reference (Task → Directory Map)

| Task / Domain | Target Path(s) | Key Constraints & Rules |
| :--- | :--- | :--- |
| **Web UI & Page Layout** | [`webapp/index.html`](file:///d:/Projects/telebirding/webapp/index.html), [`webapp/admin.html`](file:///d:/Projects/telebirding/webapp/admin.html) | Append `?v={timestamp}` to CSS `<link>` tags on edit. |
| **Stylesheets & Design System** | [`webapp/css/common.css`](file:///d:/Projects/telebirding/webapp/css/common.css), [`webapp/css/index.css`](file:///d:/Projects/telebirding/webapp/css/index.css) | Vanilla CSS only. Maintain existing color palette. |
| **Client JavaScript Logic** | [`webapp/scripts/`](file:///d:/Projects/telebirding/webapp/scripts/) | Use ES6+ modules and `State` module. Avoid global variables. |
| **Web Fonts & Icons** | [`webapp/fonts/`](file:///d:/Projects/telebirding/webapp/fonts/), [`webapp/icons/`](file:///d:/Projects/telebirding/webapp/icons/) | Static assets served with web application. |
| **Android App Code** | [`telebirding-android-app/app/src/main/java/`](file:///d:/Projects/telebirding/telebirding-android-app/app/src/main/java/) | Jetpack Compose + `SiteCache.kt` + `CachedWebViewClient.kt`. |
| **Android Build & Versioning** | [`telebirding-android-app/app/build.gradle.kts`](file:///d:/Projects/telebirding/telebirding-android-app/app/build.gradle.kts) | `compileSdk=36`, `targetSdk=36`. See [`docs/android-release.md`](file:///d:/Projects/telebirding/docs/android-release.md). |
| **Android Release Notes** | [`telebirding-android-app/app/release-notes.xml`](file:///d:/Projects/telebirding/telebirding-android-app/app/release-notes.xml) | Update `<en-US>` block on release. |
| **Offline Sync Logic** | [`telebirding-android-app/app/src/main/java/.../SiteCache.kt`](file:///d:/Projects/telebirding/telebirding-android-app/app/src/main/java/com/rakeshmalik/telebirding/SiteCache.kt) | Consult [`docs/android-cache-flow.md`](file:///d:/Projects/telebirding/docs/android-cache-flow.md). |
| **Geocoding & Boundaries** | [`webapp/scripts/modules/geo-service.js`](file:///d:/Projects/telebirding/webapp/scripts/modules/geo-service.js), [`webapp/resources/data/places.json`](file:///d:/Projects/telebirding/webapp/resources/data/places.json) | Consult [`docs/geocoding-and-boundaries.md`](file:///d:/Projects/telebirding/docs/geocoding-and-boundaries.md). |
| **Data Processing & Utilities** | [`utils/`](file:///d:/Projects/telebirding/utils/) | Python / Node scripts for taxonomy, EXIF, and data sync. |
| **Automated Testing** | [`webapp/tests/`](file:///d:/Projects/telebirding/webapp/tests/), [`run_all_tests.bat`](file:///d:/Projects/telebirding/run_all_tests.bat) | Run via `npm test` in `webapp/` or `.\run_all_tests.bat` in root. |
| **Agent Rules & Workflows** | [`.agents/AGENTS.md`](file:///d:/Projects/telebirding/.agents/AGENTS.md), [`docs/`](file:///d:/Projects/telebirding/docs/) | Always consult before modifying project core. |

---

## 📁 Repository Directory Tree

```
telebirding/
├── webapp/                      # 🌐 STATIC WEB APPLICATION FRONTEND
│   ├── index.html               # Public web catalogue entry point
│   ├── admin.html               # Internal administrative dashboard
│   ├── privacy-policy.html      # App & website privacy policy page
│   ├── 404.html                 # Fallback 404 error page
│   ├── css/                     # Application stylesheets (Vanilla CSS)
│   ├── scripts/                 # ES6 client JavaScript modules (State, filters, loaders)
│   ├── resources/               # 📦 DATA & MEDIA ASSETS (data, dataset, images, videos)
│   ├── fonts/                   # Embedded web fonts
│   ├── icons/                   # Favicon assets & app icons
│   ├── lib/                     # External JS/CSS dependencies
│   ├── tests/                   # Vitest unit test suite (jsdom environment)
│   ├── coverage/                # Generated test coverage output
│   ├── package.json             # Web application dependencies & scripts
│   ├── package-lock.json        # Dependency lockfile
│   └── vitest.config.js         # Vitest test runner configuration
│
├── telebirding-android-app/     # 📱 NATIVE ANDROID APPLICATION CONTAINER
│   ├── app/                     # Main Android module source code
│   │   ├── src/main/java/       # Kotlin UI & Caching Engine (MainActivity, SiteCache, CachedWebViewClient)
│   │   ├── src/main/res/        # App drawables, XML resources, and release-notes.xml
│   │   └── build.gradle.kts     # App build script (SDK 36, versionCode, targetSdk)
│   ├── build.gradle.kts         # Root Gradle build file
│   ├── settings.gradle.kts      # Gradle module definitions
│   └── gradle/                  # Gradle wrapper & dependency version catalog (libs.versions.toml)
│
├── utils/                       # Python & JS automation scripts (EXIF parser, media optimization)
├── docs/                        # 📚 TECHNICAL ARCHITECTURE & REFERENCE GUIDES
│   ├── android-cache-flow.md    # Android offline caching & delta media sync architecture
│   ├── android-release.md       # Android version bumping, packaging & release runbook
│   ├── geocoding-and-boundaries.md # 4-level place hierarchy & GeoJSON polygon boundaries
│   ├── ebird-api-and-syncing.md # eBird API integration & sync pipelines
│   ├── project-structure.md     # Codebase layout & directory reference
│   ├── NOTES.md                 # Design notes & decisions
│   └── TODO.md                  # Task backlog & checklist
│
├── run.bat                      # ⚡ 1-click local serve & browser launch
├── deploy.bat                   # 🚀 1-click Firebase deploy
├── run_all_tests.bat            # 🧪 Run test suites for both webapp (Vitest) & Android app (Gradle)
├── firebase.json                # Firebase Hosting (public: webapp) & Storage rules
├── storage.rules                # Firebase Storage security policies
├── netlify.toml                 # Netlify deployment rules (publish: webapp)
│
├── .agents/                     # AI Agent configuration directory
│   ├── AGENTS.md                # Project rules & strict constraints
│   ├── skills/                  # Action skills (commit)
│   └── workflows/               # Operational workflows (testing-guidelines.md)
│
└── README.md                    # Main project overview
```

---

## 🤖 Agent Execution Directives

1. **Working Directory for Commands**:
   - Web app & testing tasks: Execute commands from inside `webapp/` (e.g. `cd webapp` and `npm test`).
   - Android build tasks: Execute Gradle commands from inside `telebirding-android-app/` (e.g. `cd telebirding-android-app` and run `.\gradlew.bat <task>`).
   - Unified testing: Run `.\run_all_tests.bat` from repository root.

2. **Git Safeguard**:
   - **Do not execute any Git commands** (`git commit`, `git push`, etc.) unless explicitly instructed by the user.

3. **Cache Busting Constraint**:
   - Every time a CSS file under `css/` is modified, update the corresponding HTML files to append or update `?v={timestamp}` on the `<link rel="stylesheet">` tags.

4. **Android App Requirements**:
   - Keep `compileSdk` and `targetSdk` at **36** or higher in `telebirding-android-app/app/build.gradle.kts`.
   - Log release details in `telebirding-android-app/app/release-notes.xml`.
