# 🚨 BACKEND 502 ERROR FIX

## Problem: Backend returning 502 Bad Gateway
The frontend is working but API calls to `/api/` return 502 error, meaning nginx can't connect to the backend on port 3000.

## Step 1: Check backend logs
```bash
pm2 logs backend --lines 20
```

## Step 2: Check if backend is listening on port 3000
```bash
sudo netstat -tlnp | grep :3000
```

## Step 3: Check PM2 status
```bash
pm2 status
```

## Step 4: Navigate to backend directory
```bash
cd /home/ubuntu/frontetback/backend
```

## Step 5: Stop backend
```bash
pm2 stop backend
```

## Step 6: Restart backend properly
```bash
pm2 start npm --name "backend" -- run start:prod
```

## Step 7: Check backend environment
```bash
cat .env
```

## Step 8: Monitor backend logs
```bash
pm2 logs backend --lines 30
```

## Step 9: Test backend after restart
```bash
curl -k https://35.181.48.18/api/
```

## Step 10: If still failing, check database connection
```bash
pm2 logs backend --follow
```

## Alternative: Manual backend start (if PM2 fails)
```bash
cd /home/ubuntu/frontetback/backend
```

```bash
npm run build
```

```bash
npm run start:prod
```

## Expected Result
- Backend should respond with JSON instead of 502 error
- Socket.IO connections should work once backend is running