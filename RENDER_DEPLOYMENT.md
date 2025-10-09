# Render Deployment Guide

## Overview
Both backend API and frontend Next.js app are configured to deploy on Render using Docker.

## Quick Start

1. **Push to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Configure Render deployment"
   git push origin main
   ```

2. **Connect to Render**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository: `sivaratrisrinivas/Rashomon`
   - Render will auto-detect `render.yaml` and create both services

3. **Set Environment Variables**:
   
   **For `rashomon-api`**:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
   - `GOOGLE_CLOUD_VISION_API_KEY`: Your Google Cloud Vision API key
   
   **For `rashomon-frontend`**:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
   - `NEXT_PUBLIC_API_URL`: Auto-set to `https://rashomon-api.onrender.com` (update if needed)

4. **Deploy**: Render will automatically build and deploy both services.

## Service URLs
- **Frontend**: `https://rashomon-frontend.onrender.com`
- **Backend API**: `https://rashomon-api.onrender.com`

## Free Tier Notes
- Services spin down after 15 mins of inactivity
- First request after spin-down takes ~30-60 seconds
- 750 hours/month free (enough for both services)

## Manual Deploy
Push to `main` branch to trigger auto-deployment, or use Render dashboard "Manual Deploy" button.

## Troubleshooting

**Build fails?**
- Check logs in Render dashboard
- Verify all env vars are set
- Ensure Dockerfile paths are correct

**Frontend can't reach backend?**
- Update `NEXT_PUBLIC_API_URL` to your actual backend URL
- Check CORS settings in backend if needed

**Environment variables not working?**
- Next.js requires `NEXT_PUBLIC_` prefix for client-side vars
- **CRITICAL**: `NEXT_PUBLIC_*` vars must be set BEFORE deploying (not after)
- These vars are baked into the build at build-time, not runtime
- After setting/changing env vars, you MUST trigger a new deploy (not just restart)
- Verify all three frontend env vars are set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`

