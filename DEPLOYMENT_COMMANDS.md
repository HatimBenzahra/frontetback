# Commandes de Déploiement AWS - Ubuntu Instance

## 1. Installation des Prérequis

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt install -y python3.11 python3.11-pip python3.11-venv
sudo apt install -y postgresql postgresql-contrib
sudo apt install -y nginx
sudo npm install -g pm2
```

## 2. Configuration de PostgreSQL

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo -u postgres psql
```

```sql
CREATE DATABASE myapp;
CREATE USER myapp_user WITH PASSWORD 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE myapp TO myapp_user;
ALTER USER myapp_user CREATEDB;
\q
```

## 3. Configuration de l'Environnement

```bash
cd frontetback
cat > backend/.env << 'EOF'
DATABASE_URL="postgresql://myapp_user:YourSecurePassword123!@localhost:5432/myapp"
NODE_ENV=production
API_PORT=3000
CLIENT_HOST=localhost
EOF

cat > moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/.env.production << 'EOF'
VITE_API_URL=http://35.181.43.99/api
VITE_SOCKET_URL=ws://35.181.43.99
VITE_PYTHON_SERVER_URL=http://35.181.43.99/python
EOF
```

## 4. Installation des Dépendances

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
cd ..
cd moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b
npm install
cd ..
```

## 5. Configuration du Python Server

```bash
cd backend/python-server
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..
```

## 6. Build et Démarrage des Services

```bash
cd moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b
npm run build
cd ..
cd backend
pm2 start npm --name "backend" -- run start:prod
cd python-server
source venv/bin/activate
pm2 start audio_streaming_server.py --name "python-server" --interpreter python3.11
pm2 status
pm2 save
pm2 startup
```

## 7. Configuration de Nginx

```bash
sudo tee /etc/nginx/sites-available/frontend << 'EOF'
server {
    listen 80;
    server_name _;
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
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/frontend /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 8. Configuration du Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
sudo ufw status
```

## 9. Vérification du Déploiement

```bash
pm2 status
pm2 logs backend
pm2 logs python-server
sudo systemctl status nginx
sudo systemctl status postgresql
curl http://localhost:3000
curl http://169.254.169.254/latest/meta-data/public-ipv4
```

## 10. Commandes Utiles pour la Maintenance

```bash
pm2 restart all
pm2 logs
pm2 stop backend
pm2 start backend
sudo systemctl restart nginx
df -h
free -h
htop
```

## 11. Mise à Jour de l'Application

```bash
cd frontetback
git pull origin main
cd backend
npm install
npx prisma generate
npx prisma db push
pm2 restart backend
cd ../moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b
npm install
npm run build
cd ../backend/python-server
source venv/bin/activate
pip install -r requirements.txt
deactivate
pm2 restart python-server
```

## Accès à l'Application

Frontend: http://35.181.43.99
API Backend: http://35.181.43.99/api/
Serveur Python: http://35.181.43.99/python/ 