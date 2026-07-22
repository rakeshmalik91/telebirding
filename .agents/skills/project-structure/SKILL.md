---
name: project-structure
description: Architecture, layout, and component breakdown of the Telebirding repository. Use when navigating the codebase, locating files, understanding how the nested Android app (telebirding-app) interacts with web assets, running tests, or determining where to add new features or utility scripts.
---

# Telebirding Project Architecture & Layout

This skill provides an actionable directory guide for AI agents and developers.

---

## 🎯 Agent Quick Reference (Task → Directory Map)

| Task / Domain | Target Path(s) | Key Constraints & Rules |
| :--- | :--- | :--- |
| **Web UI & Page Layout** | [`index.html`](file:///d:/Projects/telebirding/index.html), [`admin.html`](file:///d:/Projects/telebirding/admin.html) | Append `?v={timestamp}` to CSS `<link>` tags on edit. |
| **Stylesheets & Design System** | [`css/common.css`](file:///d:/Projects/telebirding/css/common.css), [`css/index.css`](file:///d:/Projects/telebirding/css/index.css) | Vanilla CSS only. Maintain existing color palette. |
| **Client JavaScript Logic** | [`scripts/`](file:///d:/Projects/telebirding/scripts/) | Use ES6+ modules and `State` module. Avoid global variables. |
| **Android App Code** | [`telebirding-app/app/src/main/java/`](file:///d:/Projects/telebirding/telebirding-app/app/src/main/java/) | Jetpack Compose + `SiteCache.kt` + `CachedWebViewClient.kt`. |
| **Android Build & Versioning** | [`telebirding-app/app/build.gradle.kts`](file:///d:/Projects/telebirding/telebirding-app/app/build.gradle.kts) | `compileSdk=36`, `targetSdk=36`. Use `android-release` skill. |
| **Android Release Notes** | [`telebirding-app/app/release-notes.xml`](file:///d:/Projects/telebirding/telebirding-app/app/release-notes.xml) | Update `<en-US>` block on release. |
| **Offline Sync Logic** | [`telebirding-app/app/src/main/java/.../SiteCache.kt`](file:///d:/Projects/telebirding/telebirding-app/app/src/main/java/com/rakeshmalik/telebirding/SiteCache.kt) | Consult `android-cache-flow` skill. |
| **Data Processing & Utilities** | [`utils/`](file:///d:/Projects/telebirding/utils/) | Python / Node scripts for taxonomy, EXIF, and data sync. |
| **Automated Testing** | [`tests/`](file:///d:/Projects/telebirding/tests/), [`vitest.config.js`](file:///d:/Projects/telebirding/vitest.config.js) | Run via `npm test` or `npm run coverage`. |
| **Agent Rules & Workflows** | [`.agents/agents.md`](file:///d:/Projects/telebirding/.agents/agents.md), [`.agents/skills/`](file:///d:/Projects/telebirding/.agents/skills/) | Always consult before modifying project core. |

---

## 📁 Repository Directory Tree

```
telebirding/
├── index.html                   # Public web catalogue entry point
├── admin.html                   # Internal administrative dashboard
├── privacy-policy.html          # App & website privacy policy page
├── 404.html                     # Fallback 404 error page
│
├── css/                         # Application stylesheets (Vanilla CSS)
├── scripts/                     # ES6 client JavaScript modules (State, filters, loaders)
├── data/                        # Static JSON datasets (birds.json, places.json, taxa)
├── featured-images/             # Highlight thumbnails and cards
├── images/                      # High-resolution bird photography
├── videos/                      # Sightings video content (.mp4)
├── fonts/                       # Embedded web fonts
├── icons/                       # Favicon assets & app icons
├── lib/                         # External JS dependencies
│
├── telebirding-app/             # 📱 NATIVE ANDROID APPLICATION CONTAINER
│   ├── app/                     # Main Android module source code
│   │   ├── src/main/java/       # Kotlin UI & Caching Engine (MainActivity, SiteCache, CachedWebViewClient)
│   │   ├── src/main/res/        # App drawables, XML resources, and release-notes.xml
│   │   └── build.gradle.kts     # App build script (SDK 36, versionCode, targetSdk)
│   ├── build.gradle.kts         # Root Gradle build file
│   ├── settings.gradle.kts      # Gradle module definitions
│   └── gradle/                  # Gradle wrapper & dependency version catalog (libs.versions.toml)
│
├── utils/                       # Python & JS automation scripts (EXIF parser, media optimization)
├── tests/                       # Vitest unit test suite (jsdom environment)
├── coverage/                    # Generated test coverage output
│
├── firebase.json                # Firebase Hosting & headers configuration
├── storage.rules                # Firebase Storage security policies
├── netlify.toml                 # Netlify deployment rules
│
├── .agents/                     # AI Agent configuration directory
│   ├── agents.md                # Project guidelines & strict constraints
│   ├── skills/                  # Skills: android-release, android-cache-flow, project-structure
│   └── workflows/               # Operational workflows: testing-guidelines.md
│
└── README.md                    # Main project overview
```

---

## 🤖 Agent Execution Directives

1. **Working Directory for Commands**:
   - Web app & testing tasks: Execute commands from the repository root (`d:\Projects\telebirding`).
   - Android build tasks: Execute Gradle commands from inside `telebirding-app/` (e.g. `cd telebirding-app` and run `.\gradlew.bat <task>`).

2. **Git Safeguard**:
   - **Do not execute any Git commands** (`git commit`, `git push`, etc.) unless explicitly instructed by the user.

3. **Cache Busting Constraint**:
   - Every time a CSS file under `css/` is modified, update the corresponding HTML files to append or update `?v={timestamp}` on the `<link rel="stylesheet">` tags.

4. **Android App Requirements**:
   - Keep `compileSdk` and `targetSdk` at **36** or higher in `telebirding-app/app/build.gradle.kts`.
   - Log release details in `telebirding-app/app/release-notes.xml`.
