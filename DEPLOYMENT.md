# Deployment Guide

## Quick Deploy to Railway + Vercel

### Backend (Railway)

1. **Install Railway CLI**
```bash
npm install -g @railway/cli
```

2. **Login to Railway**
```bash
railway login
```

3. **Deploy Backend**
```bash
cd backend
railway init
railway up
```

4. **Add Environment Variables in Railway Dashboard**
- Go to https://railway.app/dashboard
- Select your project
- Go to Variables tab
- Add all variables from `.env.example`

5. **Add PostgreSQL Database**
```bash
railway add postgresql
```

6. **Add Redis**
```bash
railway add redis
```

Railway will automatically provide DATABASE_URL and REDIS_URL.

### Frontend (Vercel)

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Deploy Frontend**
```bash
cd frontend
vercel
```

3. **Configure Environment Variables**
- Go to https://vercel.com/dashboard
- Select your project
- Go to Settings > Environment Variables
- Add:
  - `VITE_API_URL` = your Railway backend URL
  - `VITE_GOOGLE_MAPS_API_KEY` = your Maps API key

4. **Redeploy**
```bash
vercel --prod
```

## Manual Deployment

### VPS/Cloud Server Setup

1. **Update system**
```bash
sudo apt update && sudo apt upgrade -y
```

2. **Install Node.js 20**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

3. **Install PostgreSQL**
```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres createdb leadgenius
```

4. **Install Redis**
```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
```

5. **Clone and setup**
```bash
git clone https://github.com/vm799/LeanGen.git
cd LeanGen

# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your values
npm run build
npm start

# Frontend
cd ../frontend
npm install
cp .env.example .env
# Edit .env with your values
npm run build
```

6. **Setup Nginx**
```bash
sudo apt install -y nginx

sudo nano /etc/nginx/sites-available/leadgenius
```

Add:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /path/to/LeanGen/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/leadgenius /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

7. **Setup SSL with Let's Encrypt**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

8. **Setup PM2 for process management**
```bash
npm install -g pm2

cd /path/to/LeanGen/backend
pm2 start dist/index.js --name leadgenius-api
pm2 startup
pm2 save
```

## Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## Environment Variable Checklist

### Backend (.env)
- [ ] NODE_ENV
- [ ] PORT
- [ ] DATABASE_URL
- [ ] REDIS_URL
- [ ] GOOGLE_MAPS_API_KEY
- [ ] GOOGLE_PLACES_API_KEY
- [ ] GOOGLE_SEARCH_API_KEY (optional)
- [ ] GOOGLE_SEARCH_CX (optional)
- [ ] GEMINI_API_KEY

### Frontend (.env)
- [ ] VITE_API_URL
- [ ] VITE_GOOGLE_MAPS_API_KEY

## Post-Deployment Checklist

- [ ] Test health endpoint: `https://yourdomain.com/api/health`
- [ ] Test search functionality
- [ ] Test deep analysis
- [ ] Check all API keys are working
- [ ] Monitor logs for errors
- [ ] Set up monitoring (Sentry, etc.)
- [ ] Configure backups
- [ ] Set up alerts for API quota limits

## Troubleshooting

**502 Bad Gateway**
- Check backend is running: `pm2 status`
- Check logs: `pm2 logs leadgenius-api`
- Verify Nginx config: `sudo nginx -t`

**API Key Errors**
- Verify keys in environment variables
- Check Google Cloud Console quotas
- Ensure billing is enabled

**Database Connection Errors**
- Check DATABASE_URL format
- Verify PostgreSQL is running
- Check firewall rules

**Redis Connection Errors**
- Check REDIS_URL
- Verify Redis is running: `redis-cli ping`
