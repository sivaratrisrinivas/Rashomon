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
   
   **For `rashomon-frontend`** (CRITICAL - follow exactly):
   
   a. Go to Environment tab, add:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
   - `NEXT_PUBLIC_API_URL`: `https://rashomon-api.onrender.com` (or your actual backend URL)
   
   b. **Docker build args are no longer required** thanks to runtime env injection (see below). Simply save env vars and redeploy.

4. **Deploy**: Trigger a manual deploy to build with the new configuration.

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
- Env values are now injected at runtime; make sure the four vars above are set in Render
- After changing env vars, trigger a manual redeploy so the runtime script receives the latest values

