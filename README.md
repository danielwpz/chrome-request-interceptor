# Chrome Request Interceptor Extension

Intercept HTTP requests and return custom JSON responses. Bypasses all CSP restrictions and website limitations.

**Perfect for bypassing some website restrictions like VPN blocks, geo-blocking, etc.**

## Quick Start

### Build & Install
```bash
pnpm install
```
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select this directory

### Usage
1. Click extension icon in toolbar
2. Click "Add Rule"
3. Set HTTP method, URL pattern, and JSON response
4. Save - rules apply immediately across all tabs

### Example
- **Method**: GET
- **URL Pattern**: `api.example.com/status`
- **Response**: `{"status": "ok"}`

### Use Cases
- **Bypass VPN detection**: Intercept VPN check endpoints
- **Geo-blocking**: Mock location-based API responses
- **Rate limiting**: Override rate limit headers/responses
- **API mocking**: Return custom data for development

## How It Works
Uses aggressive injection via `chrome.scripting.executeScript` to bypass ALL CSP restrictions and website security measures. Injects into every tab automatically.

## Permissions
- `storage`, `activeTab`, `scripting`, `tabs`
- `host_permissions` for `*://*/*`

## Troubleshooting
- Check browser console for `🔥 INJECTION COMPLETE` messages
- Reload extension if needed
- Works on any website except `chrome://` pages
