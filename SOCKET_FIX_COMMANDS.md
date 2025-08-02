# 🔧 SOCKET.IO FIX - SSH Commands

## Step 1: Resolve Git Conflicts
```bash
cd /home/ubuntu/frontetback
```

```bash
git stash
```

```bash
git pull origin main
```

## Step 2: Update Frontend Environment
```bash
cd /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b
```

```bash
cat > .env << 'EOF'
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiYmVuemFocmEiLCJhIjoiY21heG85dnd0MDBjbTJuc2RhbWhhOWxsMyJ9.XZm932vHWSs-cHO9lmtmKg

# FIXED - Socket.IO URLs
VITE_SERVER_HOST=35.181.48.18
VITE_API_PORT=443
VITE_API_URL=https://35.181.48.18/api
VITE_SOCKET_URL=wss://35.181.48.18
VITE_PYTHON_SERVER_URL=https://35.181.48.18/python

# Deepgram API
VITE_DEEPGRAM_API_KEY=7189f2a24e42949bf3a561b9a89328de00526605
EOF
```

## Step 3: Add Socket.IO nginx proxy
```bash
sudo tee /etc/nginx/sites-available/frontend << 'EOF'
server {
    listen 80;
    server_name _;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name _;
    
    ssl_certificate /etc/ssl/certs/nginx-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/nginx-selfsigned.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    root /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # FIXED - Socket.IO proxy
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /python/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
```

## Step 4: Rebuild and Deploy
```bash
sudo chown -R ubuntu:ubuntu dist
```

```bash
npm run build
```

```bash
sudo chown -R www-data:www-data dist
```

```bash
sudo chmod -R 755 dist
```

## Step 5: Restart Services
```bash
sudo nginx -t
```

```bash
sudo systemctl reload nginx
```

```bash
pm2 restart all
```

## Step 6: Test
```bash
v```

```bash
pm2 logs --lines 10
```

## ✅ Expected Result
- Socket.IO connects to `wss://35.181.48.18` (no port)
- No more `ERR_CONNECTION_TIMED_OUT` errors
- GPS and audio streaming work