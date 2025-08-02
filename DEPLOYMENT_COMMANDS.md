# Commandes de Déploiement AWS - Ubuntu Instance

## ⚡ COMMANDES RAPIDES DE DÉPLOIEMENT (APRÈS CHANGEMENTS)

```bash
pm2 stop all

cd moduleProspec-*
rm -rf dist/
npm run build

cd ../backend
rm -rf dist/
npm run build

pm2 start all
pm2 restart nginx

pm2 logs --lines 20
```

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
# Depuis le dossier frontetback
cat > backend/.env << 'EOF'
DATABASE_URL="postgresql://myapp_user:YourSecurePassword123!@localhost:5432/myapp"

# Configuration des adresses réseau principales
SERVER_HOST=35.180.112.84
CLIENT_HOST=35.180.112.84
API_PORT=3000

# Configuration du serveur Python de streaming audio
HTTP_PORT=8000
HTTPS_PORT=8443

# Configuration CORS et adresses autorisées
FRONTEND_PORT=5173
PRODUCTION_IP=35.180.112.84
LOCALHOST_DEV=localhost
LOCALHOST_IP=127.0.0.1

# Certificats SSL pour la production (optionnel)
SSL_CERT_FILE=/etc/ssl/certs/nginx-selfsigned.crt
SSL_KEY_FILE=/etc/ssl/private/nginx-selfsigned.key
EOF

cat > moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/.env.production << 'EOF'
VITE_API_URL=https://35.180.112.84/api
VITE_SOCKET_URL=wss://35.180.112.84
VITE_PYTHON_SERVER_URL=https://35.180.112.84/python
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

## 7. Configuration SSL et Nginx HTTPS

```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/nginx-selfsigned.key -out /etc/ssl/certs/nginx-selfsigned.crt -subj "/C=US/ST=State/L=City/O=Organization/CN=35.180.112.84"

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
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/frontend /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
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

## 12. Correction des erreurs SSL et ports

```bash
pm2 stop backend
cd backend
npm run build
pm2 start backend
pm2 stop python-server
cd python-server
pm2 start audio_streaming_server.py --name "python-server" --interpreter python3
pm2 status
curl -k https://localhost/api
curl -k https://localhost/python/health
```

## 13. Mise à jour du fichier .env avec les certificats SSL

```bash
cd frontetback
cat > backend/.env << 'EOF'
DATABASE_URL="postgresql://postgres:test@localhost:5432/newk?schema=public"

# Configuration des adresses réseau
SERVER_HOST=35.181.43.99    
CLIENT_HOST=35.181.43.99
API_PORT=3000

# Configuration du serveur Python de streaming audio
HTTP_PORT=8000
HTTPS_PORT=8443

# Configuration CORS et adresses autorisées
FRONTEND_PORT=5173
PRODUCTION_IP=35.181.43.99
LOCALHOST_DEV=localhost
LOCALHOST_IP=127.0.0.1

# Certificats SSL pour la production (optionnel)
SSL_CERT_FILE=/etc/ssl/certs/nginx-selfsigned.crt
SSL_KEY_FILE=/etc/ssl/private/nginx-selfsigned.key
EOF
```

## 14. Test des certificats SSL

```bash
# Vérifier que les certificats existent
ls -la /etc/ssl/certs/nginx-selfsigned.crt
ls -la /etc/ssl/private/nginx-selfsigned.key

# Redémarrer les services pour appliquer la configuration SSL
pm2 restart backend
pm2 restart python-server

# Tester les endpoints HTTPS
curl -k https://localhost:8443/health
curl -k https://35.180.112.84/python/health
curl -k https://35.180.112.84/api/

# Vérifier les logs pour les erreurs SSL
pm2 logs python-server --lines 20
pm2 logs backend --lines 20

# Tester depuis l'extérieur
curl -k https://35.180.112.84/python/health
```

## 15. Mise à jour du .env frontend pour la production

```bash
cd frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b
cat > .env << 'EOF'
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiYmVuemFocmEiLCJhIjoiY21heG85dnd0MDBjbTJuc2RhbWhhOWxsMyJ9.XZm932vHWSs-cHO9lmtmKg

# Configuration des adresses réseau
VITE_SERVER_HOST=35.181.43.99
VITE_API_PORT=3000
VITE_PYTHON_HTTP_PORT=8000
VITE_PYTHON_HTTPS_PORT=8443

# Deepgram API pour la transcription
VITE_DEEPGRAM_API_KEY=7189f2a24e42949bf3a561b9a89328de00526605
EOF

# Rebuild le frontend avec la nouvelle configuration
npm run build
```

## Accès à l'Application

Frontend: https://35.180.112.84
API Backend: https://35.180.112.84/api/
Serveur Python: https://35.180.112.84/python/ 


Étapes dans AWS Console :

  1. EC2 → Instances → Cliquer sur votre instance
  2. Security tab → Cliquer sur le lien Security Groups
  3. Inbound rules → Edit inbound rules
  4. Add rule (2 fois) :

  Règle 1 :
  - Type: HTTP
  - Port: 80
  - Source: 0.0.0.0/0

  Règle 2 :
  - Type: HTTPS
  - Port: 443
  - Source: 0.0.0.0/0

  5. Save rules

  🧪 Test immédiat après :

  Une fois les règles AWS ajoutées, testez :
  - https://35.180.112.84

  Votre application fonctionnera immédiatement ! 🚀

  Le serveur est parfaitement configuré, il faut juste ouvrir l'accès dans AWS !



## 16. Correction des identifiants de base de données

```bash
cd frontetback
cat > backend/.env << 'EOF'
DATABASE_URL="postgresql://myapp_user:YourSecurePassword123!@localhost:5432/myapp"

# Configuration des adresses réseau
SERVER_HOST=35.181.43.99
CLIENT_HOST=35.181.43.99
API_PORT=3000

# Configuration du serveur Python de streaming audio
HTTP_PORT=8000
HTTPS_PORT=8443

# Configuration CORS et adresses autorisées
FRONTEND_PORT=5173
PRODUCTION_IP=35.181.43.99
LOCALHOST_DEV=localhost
LOCALHOST_IP=127.0.0.1

# Certificats SSL pour la production (optionnel)
SSL_CERT_FILE=/etc/ssl/certs/nginx-selfsigned.crt
SSL_KEY_FILE=/etc/ssl/private/nginx-selfsigned.key
EOF

# Redémarrer le backend avec les bons identifiants
pm2 restart backend

# Vérifier que tout fonctionne
pm2 logs backend --lines 5
curl http://localhost:3000
curl http://localhost:8000/health
```

## 17. Diagnostic des problèmes de connexion externe

```bash
# Vérifier le statut de nginx
sudo systemctl status nginx

# Vérifier les logs d'erreur nginx
sudo tail -f /var/log/nginx/error.log

# Vérifier les logs d'accès nginx
sudo tail -f /var/log/nginx/access.log

# Tester nginx en local
curl -k https://localhost/api/
curl -k https://localhost/python/health

# Vérifier que nginx écoute sur les bons ports
sudo netstat -tlnp | grep nginx
sudo ss -tlnp | grep nginx

# Vérifier la configuration nginx
sudo nginx -t
cat /etc/nginx/sites-enabled/frontend

# Vérifier les processus qui écoutent sur les ports
sudo netstat -tlnp | grep :443
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :8000

# Tester les services localement
curl http://localhost:3000/api/
curl http://localhost:8000/health
```

## 18. Correction des permissions et répertoires

```bash
# Corriger les permissions du dossier dist pour nginx
sudo chown -R www-data:www-data /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/dist
sudo chmod -R 755 /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/dist

# Vérifier que le dossier dist existe et contient des fichiers
ls -la /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/dist/

# Si le dossier dist n'existe pas, rebuild le frontend
cd /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b
npm run build

# Redémarrer nginx après correction des permissions
sudo systemctl reload nginx

# Tester à nouveau
curl -k https://localhost/
curl -k https://localhost/api/
curl -k https://localhost/python/health
```

## 19. Correction des permissions pour le build

```bash
# Remettre les permissions ubuntu pour pouvoir build
sudo chown -R ubuntu:ubuntu /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/dist

# Rebuild avec les bonnes permissions
cd /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b
npm run build

# Donner les permissions nginx après le build
sudo chown -R www-data:www-data /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/dist
sudo chmod -R 755 /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/dist

# Redémarrer nginx
sudo systemctl reload nginx

# Test final
curl -k https://localhost/
curl -k https://35.181.43.99/

## 21. Diagnostic de l'erreur 500 nginx

```bash
sudo tail -f /var/log/nginx/error.log
```

```bash
ls -la /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/dist/
```

```bash
cat /etc/nginx/sites-enabled/frontend
```

```bash
sudo nginx -t
```
```

## 20. Commandes une par une (copier-coller séparément)


sudo chown -R ubuntu:ubuntu /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/dist


cd /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b


npm run build


sudo chown -R www-data:www-data dist


sudo chmod -R 755 dist


sudo systemctl reload nginx


curl -k https://localhost/

curl -k https://35.181.43.99/

## 21. Diagnostic de l'erreur 500 nginx


sudo tail -f /var/log/nginx/error.log


ls -la /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/dist/

cat /etc/nginx/sites-enabled/frontend

sudo nginx -t

## 22. Correction complète des permissions

sudo chmod 755 /home/ubuntu/


sudo chmod 755 /home/ubuntu/frontetback/

sudo chmod 755 /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/

sudo chown -R www-data:www-data /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/dist

sudo chmod -R 755 /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/dist

sudo systemctl reload nginx

curl -k https://localhost/

## 23. Test final - Application fonctionnelle !

curl -k https://35.181.43.99/

## ✅ Application déployée avec succès !

- **Frontend** : https://35.181.48.18
- **API Backend** : https://35.181.48.18/api/ 
- **Serveur Python** : https://35.181.48.18/python/health

**Note** : N'oubliez pas d'ouvrir les ports 80 et 443 dans AWS Security Groups si l'accès externe ne fonctionne pas encore.

## 24. Correction de l'IP publique

```bash
curl -s https://ipinfo.io/ip
```

```bash
cd /home/ubuntu/frontetback
```

```bash
cat > backend/.env << 'EOF'
DATABASE_URL="postgresql://myapp_user:YourSecurePassword123!@localhost:5432/myapp"

# Configuration des adresses réseau
SERVER_HOST=35.181.48.18
CLIENT_HOST=35.181.48.18
API_PORT=3000

# Configuration du serveur Python de streaming audio
HTTP_PORT=8000
HTTPS_PORT=8443

# Configuration CORS et adresses autorisées
FRONTEND_PORT=5173
PRODUCTION_IP=35.181.48.18
LOCALHOST_DEV=localhost
LOCALHOST_IP=127.0.0.1

# Certificats SSL pour la production (optionnel)
SSL_CERT_FILE=/etc/ssl/certs/nginx-selfsigned.crt
SSL_KEY_FILE=/etc/ssl/private/nginx-selfsigned.key
EOF
```

```bash
pm2 restart backend
```

```bash
curl -k https://35.181.48.18/
```

## 25. Correction des URLs frontend

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

```bash
npm run build
```

```bash
sudo chown -R www-data:www-data dist
```

```bash
sudo chmod -R 755 dist
```

```bash
sudo systemctl reload nginx
```

```bash
curl -k https://35.181.48.18/
```

## 26. Configuration finale des URLs (sans port)

```bash
cd /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b
```

```bash
cat > .env << 'EOF'
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiYmVuemFocmEiLCJhIjoiY21heG85dnd0MDBjbTJuc2RhbWhhOWxsMyJ9.XZm932vHWSs-cHO9lmtmKg

# Configuration des adresses réseau (SANS PORT - via nginx)
VITE_SERVER_HOST=35.181.48.18
VITE_API_PORT=443
VITE_PYTHON_HTTP_PORT=8000
VITE_PYTHON_HTTPS_PORT=8443

# URLs via nginx proxy
VITE_API_URL=https://35.181.48.18/api
VITE_SOCKET_URL=wss://35.181.48.18
VITE_PYTHON_SERVER_URL=https://35.181.48.18/python

# Deepgram API pour la transcription
VITE_DEEPGRAM_API_KEY=7189f2a24e42949bf3a561b9a89328de00526605
EOF
```

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

```bash
sudo systemctl reload nginx
```

