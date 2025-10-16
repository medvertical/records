# Vercel Deployment Configuration

## Required Environment Variables

When deploying to Vercel, the following environment variables should be configured in the Vercel dashboard:

### Required

- `NODE_ENV`: Set to `production` (already configured in `vercel.json`)

### Optional

- `DATABASE_URL`: PostgreSQL connection string for remote database support
  - Format: `postgresql://user:password@host:port/database`
  - If not provided, the application will use mock data
  - Example: `postgresql://user:pass@db.example.com:5432/records`

## How to Set Environment Variables in Vercel

1. Go to your project in the Vercel dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable with its value
4. Select the appropriate environments (Production, Preview, Development)
5. Redeploy your application for changes to take effect

## API Endpoints

The Vercel deployment uses `/api/servers` for server management (matching the development environment).

The legacy `/api/fhir/servers` endpoints have been removed to maintain consistency across environments.

## Database Support

Currently, the Vercel deployment uses mock data by default. Full remote database support is planned for future implementation.

To check database connection status, call the `/api/health` endpoint which returns:
```json
{
  "status": "ok",
  "services": {
    "database": "connected" | "disconnected",
    "databaseError": null | "error message",
    "usingMockData": true | false
  }
}
```

## Build Configuration

The build is configured in `vercel.json`:
- Static frontend files are built to `dist/public`
- API routes are handled by `api/index.js`
- All API requests are routed through the serverless function

