# NexusOS Production Deployment Guide

## 1. Vercel (Frontend)
Set the root directory to `apps/web`.

**Environment Variables:**
- `NEXT_PUBLIC_API_URL`: The public URL of the Railway API (e.g. `https://api.nexusos.app`)

## 2. Railway (Backend & Workers)
Deploy the root repository using the provided `railway.toml`.

**Services needed:**
1. Postgres Database
2. Redis Instance
3. Web Service (running the API & Workers)

**Environment Variables:**
- `DATABASE_URL`: Connection string from your Railway Postgres instance. Note: Append `?connection_limit=5` for Prisma pooling bounds.
- `REDIS_URL`: Connection string from your Railway Redis instance.
- `PORT`: e.g. `3000`
- `NODE_ENV`: `production`
- `JWT_SECRET`: Random 256-bit secure string
- `ENCRYPTION_KEY`: 32-byte hex string for AES-256-GCM token encryption
- `CORS_ORIGIN`: Your Vercel domain (e.g., `https://nexusos.app`)
- `API_BASE_URL`: The public URL of the Railway API, used internally to fetch tokens.

**OAuth Credentials:**
You must configure the following to enable the connectors:
- Slack: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI`
- Google/Gmail: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`
- Google Calendar: `GCAL_CLIENT_ID`, `GCAL_CLIENT_SECRET`, `GCAL_REDIRECT_URI`
- GitHub: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`

*Note: The system will fatally exit on boot if these are not provided.*
