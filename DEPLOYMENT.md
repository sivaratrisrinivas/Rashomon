# Deployment Guide

Quick reference for deploying Rashomon to production.

## Backend → Render (No Credit Card Required)

### Setup

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub
   - No credit card needed for free tier

3. **Deploy**
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Render auto-detects `render.yaml`
   - Set environment variables:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `GOOGLE_CLOUD_VISION_API_KEY`
   - Click "Create Web Service"

4. **Get Your URL**
   - Will be like: `https://rashomon-api.onrender.com`
   - Copy this for frontend config

### Monitor

- View logs in Render dashboard
- Free tier: sleeps after 15min inactivity
- Wakes automatically on first request (~30s delay)

## Frontend → Vercel

### Option 1: Via Dashboard

1. Go to [vercel.com](https://vercel.com)
2. New Project → Import from GitHub
3. Root Directory: `app`
4. Add env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` (your Render URL)
5. Deploy

### Option 2: Via CLI

```bash
# Install
npm i -g vercel

# Deploy
cd app
vercel

# Set env vars
vercel env add NEXT_PUBLIC_API_URL
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# Redeploy with env vars
vercel --prod
```

## Post-Deployment

### Update Supabase Auth
- Supabase Dashboard → Authentication → URL Configuration
- Add your Vercel URL to allowed redirect URLs

### Setup GitHub Secrets
Repository Settings → Secrets → Actions:
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLOUD_VISION_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL
```

### Test Everything
1. Sign in with Google
2. Complete onboarding
3. Import content via URL
4. Highlight text
5. Test chat (ideally with 2nd person)

## Getting Secret Values

### Supabase (4 secrets)
1. Go to [supabase.com](https://supabase.com) → Your Project
2. Settings → API
3. Copy:
   - **Project URL** → `SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### Google Cloud Vision (1 secret)
1. [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials
3. Create Credentials → API Key
4. Copy key → `GOOGLE_CLOUD_VISION_API_KEY`

### Backend URL (1 secret)
- After deploying to Render, copy the URL
- Will be like: `https://rashomon-api.onrender.com`
- Use as `NEXT_PUBLIC_API_URL`

## Quick Fixes

**Backend not responding?**
- Check Render dashboard logs
- Free tier sleeps after 15min - first request wakes it

**Frontend can't reach API?**
- Check `NEXT_PUBLIC_API_URL` in Vercel dashboard
- Verify CORS enabled in backend

**Auth redirect broken?**
- Confirm Vercel domain in Supabase redirect URLs
- Check `/auth/callback` route exists

## Free Tier Limits

**Render**: 
- 750 hours/month (enough for always-on)
- Sleeps after 15min inactivity
- No credit card required

**Vercel**: 
- 100GB bandwidth/month
- Unlimited deployments
- No credit card for hobby tier

Perfect for MVP/prototype.
