# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Plasmo browser extension** (Chrome/Edge/Firefox) built with TypeScript and React. The extension uses Manifest V3 architecture with a service worker-based background script.

## Development Commands

```bash
# Install dependencies (uses pnpm)
pnpm install

# Development mode with hot reload - builds to build/chrome-mv3-dev/
pnpm dev

# Production build for all browsers
pnpm build

# Create distributable ZIP packages
pnpm package

# ESLint (flat config) and unit tests
pnpm lint
pnpm test
pnpm test:watch
```

**Loading the extension in development:**
1. Run `pnpm dev`
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge)
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `build/chrome-mv3-dev` directory

## Architecture

Plasmo extensions have three main entry points that communicate via Chrome's message passing API:

```
┌─────────────┐     chrome.runtime.sendMessage()     ┌──────────────┐
│  popup.tsx  │ ──────────────────────────────────> │ background.ts │
│  (React UI) │ <────────────────────────────────── │ (Service      │
└─────────────┘     sendResponse() in listener      │  Worker)      │
                                                     └──────────────┘
                                                            ▲
┌─────────────┐     chrome.runtime.sendMessage()          │
│ content.ts  │ ──────────────────────────────────────────┘
│ (Page       │ <───────────────────────────────────────
│  Context)   │     sendResponse() in listener
└─────────────┘
```

**Component responsibilities:**

- **popup.tsx** - React component that renders when user clicks the extension icon. Has access to Chrome extension APIs but runs in an isolated context.

- **background.ts** - Service worker that runs persistently in the background. Handles extension lifecycle events (install/update), manages state, and acts as the message hub between popup and content scripts. Returns `true` from message listeners to enable async responses.

- **content.ts** - Injected into every web page (<all_urls>). Has full DOM access to the page and can modify page content. Communicates with background via `chrome.runtime.sendMessage()`.

**Message passing pattern:**
```typescript
// Sender (e.g., content.ts)
chrome.runtime.sendMessage({ action: "ping" }, (response) => {
  console.log(response) // { status: "pong" }
})

// Receiver (e.g., background.ts)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ status: "pong" })
  }
  return true // Required for async response
})
```

## File Structure

- `popup.tsx` - Extension popup UI (React)
- `background.ts` - Background service worker
- `content.ts` - Content script injected into pages
- `style.css` - Popup component styles
- `assets/` - Extension icons (PNG/SVG)
- `package.json` - Contains Plasmo config and manifest permissions

## Code Style

- **Formatter:** Prettier (configured in `.prettierrc`)
  - No semicolons, double quotes, 2-space indentation, 80 char line width
  - VS Code format-on-save is enabled in devcontainer

- **TypeScript:** Strict mode enabled, extends Plasmo base config

## Important Notes

- The extension has host permissions for all HTTPS sites (`"https://*/*"`) configured in package.json manifest section
- Content scripts run on all URLs (`<all_urls>`)
- All user-facing text is in Chinese
- Plasmo automatically generates manifest.json and icons during build
- The `.plasmo/` directory contains framework-generated files - do not edit manually
- No testing framework is currently configured
