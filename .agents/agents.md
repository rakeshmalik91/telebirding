# Project Rules (Antigravity)

This file defines coding standards and rules for the Antigravity agent to follow in this project.

## General
- **Do not execute any Git commands** (e.g., `git commit`, `git push`, `git stash`, etc.) unless explicitly instructed to do so by the user.
- Ensure all code is compatible with the existing project structure (Vanilla JS + jQuery).
- Maintain responsiveness for mobile and desktop views.
- Keep functions small and modular.
- **Frontend Verification**: Any frontend changes must be verified for workability on:
  - Desktop browsers
  - Android app (located in the [telebirding-app](file:///./telebirding-app/) folder)
  - Mobile browsers
  - Collapsible/split-screen browsers for iPad

## JavaScript
- Use ES6+ syntax (const/let, arrow functions, modules).
- Use strictly typed interactions where possible (even if just via JSDoc).
- Avoid global variables; use the `State` module or `Constants`.

## CSS
- Use Vanilla CSS (no preprocessors unless requested).
- Maintain the existing color palette defined in `common.css`.
- Ensure z-indices are managed carefully (overlays, loaders).
- **Cache Busting**: When making changes to CSS files, ALWAYS update the corresponding HTML files to append or update the `?v={current-timestamp}` query parameter on the CSS `<link>` imports.

## Antigravity Specific
- **Rule Enforcement**: Always refer to this file and `.cursorrules` before suggesting or implementing changes.
- **Workflow Usage**: Check `.agents/workflows` for specific operational procedures before starting complex tasks.
- **Project Structure**: Be mindful of the split between static files in the root and processing scripts in the `utils/` directory.
- **Requirements Tooling**: Be aware that generating `requirements.txt` can sometimes cause the agent to freeze. If this occurs, try creating the file with minimal contents and then appending dependencies, or use `run_command` with `echo` as an alternative to `write_to_file`.
- **Android App**: The Android app is located under the `telebirding-app` folder and it only opens the cached website.

