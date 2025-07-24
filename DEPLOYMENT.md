# Production Deployment Instructions

## Backend Deployment (api.destinyengine.xyz)

1. **Setup Environment**:
   ```bash
   cd /path/to/kundali-app/Backend
   
   # Copy production environment file
   cp .env.production .env
   
   # Install Python dependencies
   pip install -r requirements.txt
   ```

2. **Start with PM2**:
   ```bash
   # Using ecosystem file
   pm2 start ecosystem.config.js
   
   # Or single command
   pm2 start kundali_generator.py --name "kundali-backend" --interpreter python3
   ```

3. **Monitor**:
   ```bash
   pm2 status
   pm2 logs kundali-backend
   pm2 monit
   ```

## Frontend Deployment (destinyengine.xyz)

1. **Setup Environment**:
   ```bash
   cd /path/to/kundali-app/Frontend
   
   # Update .env.local for production
   # NEXT_PUBLIC_BACKEND_URL=https://api.destinyengine.xyz
   ```

2. **Build and Deploy**:
   ```bash
   npm run build
   pm2 start npm --name "kundali-frontend" -- start
   ```

## Troubleshooting

1. **Check CORS Settings**: Ensure backend .env has correct FRONTEND_URL
2. **Check Network**: Test direct backend access: `curl https://api.destinyengine.xyz/kundali?...`
3. **Check Logs**: `pm2 logs kundali-backend`
4. **Check Browser Console**: Look for CORS errors or network failures

## Environment Variables

### Backend (.env)
- `FASTAPI_HOST=0.0.0.0`
- `FASTAPI_PORT=8000`
- `FRONTEND_URL=https://destinyengine.xyz,https://www.destinyengine.xyz`

### Frontend (.env.local)
- `NEXT_PUBLIC_BACKEND_URL=https://api.destinyengine.xyz`
- `NEXTAUTH_URL=https://destinyengine.xyz`
