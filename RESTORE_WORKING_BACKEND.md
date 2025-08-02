# 🔙 RESTORE WORKING BACKEND CONFIGURATION

## Step 1: Backup current nginx config
```bash
sudo cp /etc/nginx/sites-available/frontend /etc/nginx/sites-available/frontend.broken
```

## Step 2: Restore original working nginx configuration
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

    location /python/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_Set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
```

## Step 3: Test nginx config
```bash
sudo nginx -t
```

## Step 4: Reload nginx
```bash
sudo systemctl reload nginx
```

## Step 5: Test backend
```bash
curl -k https://35.181.48.18/api/
```

## Step 6: If still not working, revert frontend env too
```bash
cd /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b
```

```bash
cat > .env << 'EOF'
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiYmVuemFocmEiLCJhIjoiY21heG85dnd0MDBjbTJuc2RhbWhhOWxsMyJ9.XZm932vHWSs-cHO9lmtmKg

# Configuration des adresses réseau
VITE_SERVER_HOST=35.181.48.18
VITE_API_PORT=3000
VITE_PYTHON_HTTP_PORT=8000
VITE_PYTHON_HTTPS_PORT=8443

# Deepgram API pour la transcription
VITE_DEEPGRAM_API_KEY=7189f2a24e42949bf3a561b9a89328de00526605
EOF
```

## Step 7: Rebuild if needed
```bash
npm run build
sudo chown -R www-data:www-data dist
sudo chmod -R 755 dist
sudo systemctl reload nginx
```

## Step 8: Final test
```bash
curl -k https://35.181.48.18/api/
curl -k https://35.181.48.18/
```