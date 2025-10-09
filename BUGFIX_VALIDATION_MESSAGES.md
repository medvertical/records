# Bugfix: Validation Messages API Returning HTML

## Problem

Die Validation Messages API auf der Resource Detail Seite gibt HTML statt JSON zurück:

```
Failed to load validation messages: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

## Root Cause

Es gab **zwei Catch-All-Routen** die HTML statt JSON zurückgaben:

### 1. `server/index.ts` (Line 69-70)
```typescript
// In production, serve static files
serveStatic(app);
```

**Problem:** Diese Zeile wurde IMMER ausgeführt, auch im Development-Modus. Die `serveStatic()` Funktion enthält eine Catch-All-Route `app.use("*", ...)` die `index.html` für alle Requests zurückgibt.

### 2. `server/dev-server.ts` (Lines 55-61)
```typescript
// Serve static files from dist/public in development
app.use(express.static('dist/public'));

// Fall through to index.html for client-side routing (SPA)
app.use("*", (_req, res) => {
  res.sendFile('dist/public/index.html', { root: process.cwd() });
});
```

**Problem:** Auch der Development-Server hatte eine Catch-All-Route die alle API-Requests abgefangen hat.

## Solution

### ✅ Fix 1: `server/index.ts` 
```typescript
// In production, serve static files
if (process.env.NODE_ENV === 'production') {
  serveStatic(app);
}
```

Im Development-Modus wird Vite die statischen Dateien servieren, daher brauchen wir hier keine Catch-All-Route.

### ✅ Fix 2: `server/dev-server.ts`
```typescript
// In development, Vite handles static files and client-side routing
// Only serve API routes from Express
```

Entfernte die Catch-All-Route komplett. Im Development übernimmt Vite das Client-Side-Routing.

## How to Restart

Um die Fixes zu übernehmen, musst du die Server neu starten:

### Option 1: Full Development Stack (Empfohlen)
```bash
# Stoppe alle laufenden Prozesse
pkill -f "tsx.*dev-server" || true
pkill -f "vite" || true

# Starte beide Server (Vite + Express)
npm run dev:full
```

**Dann öffne:** `http://localhost:5173` (Vite Dev Server)

Vite wird API-Requests automatisch an `http://localhost:3000` proxyen.

### Option 2: Nur Backend (für API-Tests)
```bash
# Stoppe laufende Prozesse
pkill -f "tsx.*dev-server" || true

# Starte nur Express Backend
npm run dev
```

**Dann teste:** `curl http://localhost:3000/api/health/liveness`

Sollte JSON zurückgeben: `{"status":"ok","timestamp":"..."}`

## Verification

Nach dem Neustart sollten diese Endpoints funktionieren:

1. **Health Check:**
   ```bash
   curl http://localhost:3000/api/health/liveness
   # Returns: {"status":"ok",...}
   ```

2. **Validation Groups:**
   ```bash
   curl "http://localhost:3000/api/validation/issues/groups?serverId=1"
   # Returns: {"groups":[...],"total":...}
   ```

3. **Resource Messages:**
   ```bash
   curl "http://localhost:3000/api/validation/resources/Patient/123/messages?serverId=1"
   # Returns: {"resourceType":"Patient","fhirId":"123","aspects":[...]}
   ```

## Architecture Overview

### Development Mode
```
Browser → http://localhost:5173 (Vite Dev Server)
                  ↓
           Proxies /api/* requests
                  ↓
          http://localhost:3000 (Express API)
```

### Production Mode
```
Browser → http://localhost:3000 (Express Server)
                  ↓
           ├─ /api/* → API Routes
           └─ /* → Static Files (React App)
```

## Files Modified

1. ✅ `server/index.ts` - Added `NODE_ENV` check for `serveStatic()`
2. ✅ `server/dev-server.ts` - Removed catch-all route

## Next Steps

1. **Restart the servers** using `npm run dev:full`
2. **Open your browser** to `http://localhost:5173`
3. **Navigate** to a resource detail page
4. **Verify** that validation messages now load correctly
5. **Check the browser console** for any remaining errors

## Additional Notes

- In Development: Vite serves at `:5173`, Express API at `:3000`
- In Production: Single server on `:3000` (or `$PORT`)
- All API routes are available at `/api/*`
- Frontend is automatically proxied by Vite config

---

**Status:** ✅ Fixed  
**Date:** $(date "+%Y-%m-%d %H:%M")  
**Files Changed:** 2  
**Breaking:** No (backward compatible)

