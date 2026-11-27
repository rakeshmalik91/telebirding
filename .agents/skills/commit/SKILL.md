---
name: commit
description: Commits changes with a concise conventional commit message prefix (feat, fix, refactor, test, docs, style, chore). Use this skill whenever the user asks to commit, run /commit, or save changes to git (commit only, no git push).
---

# Commit Skill

Automated runbook to safely verify, stage, and commit changes with a standard conventional commit prefix to the local git repository (**commit only, no push**).

---

## Mandatory Pre-Commit Requirements

Before committing, **ALWAYS** perform the following three steps in order:

1. **Ensure all tests pass for both Webapp and Android**:
   - Run the full test suite using `run_all_tests.bat`:
     ```cmd
     .\run_all_tests.bat
     ```
   - Alternatively run both individually:
     - Webapp (Vitest): `npm test` in `webapp/`
     - Android (Gradle): `.\gradlew.bat test` (or `.\gradlew.bat compileDebugKotlin`) in `telebirding-android-app/`
   - If any test fails, do **not** proceed with commit until resolved.

2. **Ensure Cache Busting Query Parameters are Updated**:
   - Check if any CSS files under `webapp/css/` were modified.
   - For every modified stylesheet, verify that the corresponding `<link rel="stylesheet">` tags in `webapp/index.html` and/or `webapp/admin.html` have their cache-busting timestamp updated: `?v={current-timestamp}` (e.g. `?v=YYYYMMDD_HHMM`).

3. **Update Existing Documentation if Applicable**:
   - Review the diff to identify any changed subsystems, behaviors, UI flows, data formats, or configuration.
   - Update corresponding guides in `docs/` (`docs/project-structure.md`, `docs/android-cache-flow.md`, `docs/geocoding-and-boundaries.md`, `docs/ebird-api-and-syncing.md`, `docs/NOTES.md`, `docs/TODO.md`, or `README.md`).
   - Keep documentation accurate and aligned with the active codebase.

---

## Commit Message Prefix Standards

Every commit message **MUST** be a small, concise, one-liner using the appropriate prefix:

| Prefix | Description | Example |
| :--- | :--- | :--- |
| `feat:` | New feature, UI addition, or functional capability | `feat: add copy url button in feed filter` |
| `fix:` | Bug fix or regression patch | `fix: center count badge and enable touch scroll on ipad` |
| `refactor:` | Code restructuring without behavior changes | `refactor: extract touch event listeners in preview` |
| `style:` | CSS, layout, spacing, or visual adjustments | `style: make preview thumbnail lists single row scrollable` |
| `test:` | Adding, updating, or fixing unit/integration tests | `test: add unit tests for public ui helpers` |
| `docs:` | Documentation, guide, or architecture updates | `docs: document ebird sync pipelines and api limits` |
| `perf:` | Performance improvements or optimizations | `perf: lazy load per-country geo boundary polygons` |
| `chore:` | Dependency bumps, build scripts, or maintenance | `chore: update agp dependencies and gradle config` |

> [!IMPORTANT]
> - Always keep the commit message concise, one-liner, and under 72 characters.
> - Use imperative mood (e.g., `feat: add ...`, not `feat: added ...`).
> - Do not add a trailing period.
> - **COMMIT ONLY**: Do **NOT** push to remote. Never run `git push` unless the user explicitly asks to push in a separate prompt.

---

## Execution Runbook

### Step 1: Ensure All Tests Pass
Verify that both Webapp (Vitest) and Android (Gradle) tests pass with zero failures:
```cmd
.\run_all_tests.bat
```

### Step 2: Ensure Cache Busting & Docs Are Updated
Confirm that modified CSS files have bumped timestamp versions in HTML, and relevant documentation is current.

### Step 3: Inspect Status & Stage Changes
Review all modifications:
```powershell
git status -s
git diff
```
Stage all intended changes (including documentation, data files, and code):
```powershell
git add -A
```
Verify staged files with `git status -s`. Ensure no unintended files (temporary scratch files, secrets, local logs) are staged.

### Step 4: Formulate Commit Message
1. Identify the primary category of changes (feature, bugfix, styling, tests, docs, refactor, chore).
2. Draft a clear, concise one-liner with the corresponding prefix (e.g. `style: make preview thumbnail lists single row scrollable`).

### Step 5: Commit Changes (Local Only)
Execute the commit:
```powershell
git commit -m "<type>: <concise description>"
```

### Step 6: Confirm & Report
Verify that the commit was created and report the commit hash and one-liner message to the user:
```powershell
git log -1 --oneline
```
> [!WARNING]
> Stop here! Do **NOT** execute `git push`.
