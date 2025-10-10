# Railway Production Deployment Guide

This guide covers deploying Rashomon to Railway with production-ready configuration, monitoring, and CI/CD.

## Prerequisites

- GitHub account (for CI/CD)
- Railway account (sign up at [railway.app](https://railway.app))
- Supabase project (for database and auth)
- Google Cloud account (for Vision API)

## Quick Start

### 1. Prepare Your Repository

```bash
# Ensure all changes are committed
git add .
git commit -m "Configure Railway deployment"
git push origin main
```

### 2. Deploy to Railway

#### Option A: Railway Dashboard (Recommended)

1. **Go to Railway Dashboard**
   - Visit [railway.app](https://railway.app)
   - Sign up/login with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `Rashomon` repository

3. **Configure Services**
   Railway will auto-detect both services from the monorepo:
   - **Backend Service** (from `api/` directory)
   - **Frontend Service** (from `app/` directory)

4. **Set Environment Variables**

   **Backend Service:**
   ```
   SUPABASE_URL=your-supabase-project-url
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   GOOGLE_CLOUD_VISION_API_KEY=your-google-cloud-vision-api-key
   PORT=3001
   NODE_ENV=production
   ```

   **Frontend Service:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   NEXT_PUBLIC_API_URL=https://your-backend-service.railway.app
   PORT=3000
   NODE_ENV=production
   ```

5. **Deploy**
   - Click "Deploy" for each service
   - Wait for builds to complete (2-3 minutes each)

#### Option B: Railway CLI

```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Login to Railway
railway login

# Deploy backend
cd api
railway up

# Deploy frontend
cd ../app
railway up
```

### 3. Configure GitHub Secrets

Add these to your GitHub repository (Settings → Secrets and variables → Actions):

```
RAILWAY_TOKEN=your-railway-auth-token
RAILWAY_PROJECT_ID=your-railway-project-id
RAILWAY_BACKEND_URL=https://your-backend-service.railway.app
RAILWAY_FRONTEND_URL=https://your-frontend-service.railway.app
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GOOGLE_CLOUD_VISION_API_KEY=your-google-cloud-vision-api-key
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_API_URL=https://your-backend-service.railway.app
```

### 4. Update Supabase Auth Settings

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your Railway frontend URL to "Site URL" and "Redirect URLs"
3. Save changes

## Environment Variables Reference

### Backend Service

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://abc123.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `GOOGLE_CLOUD_VISION_API_KEY` | Google Vision API key | `AIzaSyB...` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `production` |

### Frontend Service

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `NEXT_PUBLIC_API_URL` | Backend service URL | `https://rashomon-api.railway.app` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `production` |

## Getting Required Values

### Supabase Configuration

1. Go to [supabase.com](https://supabase.com) → Your Project
2. Settings → API
3. Copy:
   - **Project URL** → `SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### Google Cloud Vision API

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials
3. Create Credentials → API Key
4. Copy key → `GOOGLE_CLOUD_VISION_API_KEY`

### Railway Values

1. **Project ID**: Railway Dashboard → Project Settings → General
2. **Auth Token**: Railway CLI → `railway auth login` or Dashboard → Account Settings
3. **Service URLs**: Railway Dashboard → Services → Copy URLs

## CI/CD Pipeline

The GitHub Actions workflow automatically:

- Runs tests on every push/PR
- Deploys to staging on PRs
- Deploys to production on merge to main
- Performs health checks after deployment

### Manual Deployment

```bash
# Deploy specific service
railway up --service backend
railway up --service frontend

# Deploy all services
railway up
```

## Monitoring & Health Checks

### Health Endpoints

- **Backend**: `https://your-backend.railway.app/health`
- **Frontend**: `https://your-frontend.railway.app/api/health`

### Railway Dashboard

- **Metrics**: CPU, Memory, Network usage
- **Logs**: Real-time application logs
- **Deployments**: Deployment history and status

### Logs

```bash
# View logs via CLI
railway logs --service backend
railway logs --service frontend

# Follow logs in real-time
railway logs --service backend --follow
```

## Troubleshooting

### Common Issues

**Backend won't start:**
- Check environment variables in Railway dashboard
- Verify Supabase credentials
- Check logs: `railway logs --service backend`

**Frontend can't reach backend:**
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check CORS configuration
- Ensure backend is running and healthy

**Auth redirect fails:**
- Update Supabase redirect URLs with Railway domain
- Check auth callback route exists

**Build failures:**
- Check Railway build logs
- Verify all dependencies are in package.json
- Ensure Bun version compatibility

### Debug Commands

```bash
# Check service status
railway status

# View environment variables
railway variables

# Connect to service shell
railway connect

# View service metrics
railway metrics
```

## Security Considerations

### Railway Secrets

- Use Railway secrets (not environment variables) for sensitive data
- Rotate API keys regularly
- Monitor usage in service dashboards

### CORS Configuration

The backend is configured to accept requests from:
- `localhost:3000` (development)
- `*.railway.app` (Railway domains)
- `*.vercel.app` (Vercel domains)
- `*.onrender.com` (Render domains)

### Rate Limiting

- 100 requests per 15 minutes per IP
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- 429 status code when exceeded

## Scaling

### Railway Auto-scaling

- Services automatically scale based on traffic
- No configuration needed for basic scaling
- Monitor usage in Railway dashboard

### Performance Optimization

- Backend uses connection pooling for Supabase
- Frontend uses Next.js standalone output
- Static assets served via Railway CDN

## Rollback Procedures

### Automatic Rollback

Railway automatically rolls back on deployment failures.

### Manual Rollback

```bash
# Rollback to previous deployment
railway rollback --service backend
railway rollback --service frontend

# Rollback to specific deployment
railway rollback --service backend --deployment <deployment-id>
```

## Cost Management

### Railway Pricing

- **Free Tier**: $5/month credit
- **Pro Plan**: $20/month per service
- **Enterprise**: Custom pricing

### Cost Optimization

- Use Railway's built-in monitoring to track usage
- Set up alerts for unusual usage patterns
- Consider upgrading to Pro for production workloads

## Support

### Railway Support

- Documentation: [docs.railway.app](https://docs.railway.app)
- Community: [Railway Discord](https://discord.gg/railway)
- Status: [status.railway.app](https://status.railway.app)

### Project Support

- GitHub Issues: Report bugs and feature requests
- Documentation: Check README.md for setup instructions
- Community: Join discussions in repository

---

**Ready to deploy?** Follow the Quick Start guide above, and your Rashomon application will be live on Railway in minutes!
