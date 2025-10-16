# Vercel Deployment - Real FHIR Data Configuration

## Overview

Your Vercel deployment is now configured to use your **full server** (`server.ts`) which connects to real FHIR servers and returns actual data, not mocks.

## What Changed

### 1. vercel.json
**Before:**
```json
{
  "src": "api/index.js",  // Simple mock server
  "use": "@vercel/node"
}
```

**After:**
```json
{
  "src": "server.ts",  // Full server with real FHIR client
  "use": "@vercel/node"
}
```

### 2. server.ts
Added conditional server startup and Vercel export:
```typescript
// Only start the server if not in Vercel/serverless environment
if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  server.listen({...});
}

// Export for Vercel serverless
export default app;
```

## Required Environment Variables in Vercel

You **MUST** configure these environment variables in your Vercel project settings:

### 1. DATABASE_URL (Required)
Your PostgreSQL database connection string:
```
DATABASE_URL=postgresql://user:password@host:5432/database
```

This is needed to:
- Get your configured FHIR servers
- Store validation results
- Access server configurations

### 2. NODE_ENV (Auto-set by Vercel)
```
NODE_ENV=production
```

### 3. Optional: Feature Flags
```
DEMO_MOCKS=false  // Use real data, not mocks
```

## How to Set Environment Variables in Vercel

### Via Vercel Dashboard:
1. Go to your project in Vercel dashboard
2. Click "Settings"
3. Click "Environment Variables"
4. Add each variable:
   - Name: `DATABASE_URL`
   - Value: Your PostgreSQL connection string
   - Environments: Production, Preview, Development
5. Click "Save"

### Via Vercel CLI:
```bash
vercel env add DATABASE_URL production
# Paste your database URL when prompted
```

## How It Works

1. **Vercel receives request** → `/api/fhir/resources`

2. **server.ts handles it**:
   - Connects to your PostgreSQL database
   - Queries for the active FHIR server configuration
   - Creates a `FhirClient` with that server's URL
   - Fetches real resources from the FHIR server
   - Returns actual FHIR data

3. **Frontend displays real data** from your FHIR server

## Testing

### 1. Check Health Endpoint
```bash
curl https://your-app.vercel.app/api/health
```

Should show:
```json
{
  "status": "ok",
  "services": {
    "database": "connected",  // ← Should be "connected"
    "fhirClient": "initialized",
    "usingMockData": false      // ← Should be false
  }
}
```

### 2. Check FHIR Servers
```bash
curl https://your-app.vercel.app/api/servers
```

Should return your **real** configured servers from the database, not mock data.

### 3. Check FHIR Resources
```bash
curl https://your-app.vercel.app/api/fhir/resources
```

Should return **real** FHIR resources from your active FHIR server.

## Troubleshooting

### "Database unavailable" Error
**Problem**: `DATABASE_URL` not set or database unreachable

**Solution**:
1. Verify `DATABASE_URL` is set in Vercel environment variables
2. Check database is accessible from Vercel's IP addresses
3. Verify connection string format:
   ```
   postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
   ```

### "No FHIR server configured" Error
**Problem**: No active FHIR server in database

**Solution**:
1. Access your app's Settings page
2. Add a FHIR server configuration
3. Activate the server

### Still Seeing Mock Data
**Problem**: Deployment using old build

**Solution**:
```bash
# Trigger a new deployment
git commit --allow-empty -m "Trigger Vercel rebuild"
git push origin main
```

### FHIR Server Connection Timeout
**Problem**: FHIR server URL unreachable from Vercel

**Solution**:
1. Verify FHIR server URL is publicly accessible
2. Check FHIR server allows requests from Vercel IPs
3. Test connection manually:
   ```bash
   curl https://your-fhir-server.com/metadata
   ```

## Deployment Checklist

- [ ] Set `DATABASE_URL` in Vercel environment variables
- [ ] Database is accessible from internet (or via VPC)
- [ ] At least one FHIR server configured in database
- [ ] FHIR server is publicly accessible or allow-listed
- [ ] Build and deploy:
  ```bash
  npm run build
  git add .
  git commit -m "Configure Vercel for real FHIR data"
  git push origin main
  ```
- [ ] Verify `/api/health` shows `database: "connected"`
- [ ] Verify `/api/servers` returns real servers
- [ ] Verify `/api/fhir/resources` returns real FHIR data
- [ ] Test in browser - Resources page should show real data

## Benefits

✅ **Real FHIR Data**: Fetch actual resources from your FHIR servers
✅ **Full Functionality**: All validation, filtering, searching works
✅ **Database Integration**: Store configurations, validation results
✅ **Production Ready**: Same server code as development
✅ **No Mocks**: Authentic FHIR workflow

## Next Steps

1. Set up `DATABASE_URL` in Vercel (see above)
2. Deploy the changes:
   ```bash
   npm run build
   git add vercel.json server.ts VERCEL_REAL_DATA_SETUP.md
   git commit -m "Configure Vercel to use real FHIR data"
   git push origin main
   ```
3. Wait for Vercel to deploy (~2 minutes)
4. Visit your app and verify real data appears

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check `/api/health` endpoint
3. Verify environment variables are set
4. Test database connection separately

Your deployment will now show **real FHIR data** from your configured servers! 🎉

