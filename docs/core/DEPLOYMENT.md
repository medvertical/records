# Deployment Guide for Records FHIR Validation Platform

## Vercel Deployment

### Quick Setup

1. **Connect Repository**: Import your GitHub repo to Vercel
2. **Build Settings**:
   - Framework Preset: Other
   - Build Command: `npm run build`
   - Output Directory: `dist/public`
3. **Environment Variables**: Set `NODE_ENV=production`
4. **Deploy**: Click deploy and wait for completion

### Troubleshooting 404 Errors

**Common Issues:**
- Ensure `api/index.ts` exists and exports Express app
- Check `vercel.json` configuration
- Verify build completed successfully

**Quick Fixes:**
1. Check build logs in Vercel dashboard
2. Test `/api/health` endpoint
3. Verify file structure matches expected layout

### File Structure Required
```
your-project/
├── api/index.ts          # Main API function
├── dist/public/          # Built frontend assets
├── vercel.json           # Vercel configuration
└── package.json          # Dependencies
```

### Environment Variables
```bash
NODE_ENV=production
DATABASE_URL=your_database_url  # Optional
```

### Testing Deployment
1. Access root URL: `https://your-project.vercel.app`
2. Test API: `https://your-project.vercel.app/api/health`
3. Check static assets load correctly

For detailed troubleshooting, check Vercel dashboard logs and ensure all files are properly committed to your repository.