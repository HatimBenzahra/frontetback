# 🐳 Dockerisation du Projet Prospec

Ce document explique comment utiliser Docker pour déployer l'application Prospec.

## 📋 Prérequis

- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- Au moins 4GB de RAM disponible

## 🚀 Démarrage rapide

### 1. Cloner le projet
```bash
git clone <repository-url>
cd frontetback
```

### 2. Lancer l'application
```bash
# Construire et démarrer tous les services
docker-compose up --build

# Ou en mode détaché
docker-compose up -d --build
```

### 3. Accéder à l'application
- **Frontend** : http://localhost:5173
- **Backend API** : http://localhost:3000
- **Serveur Python** : http://localhost:8000
- **Base de données** : localhost:5432

## 🏗️ Architecture Docker

### Services inclus :

1. **postgres** - Base de données PostgreSQL
   - Port : 5432
   - Base de données : prospec_db
   - Utilisateur : prospec_user

2. **backend** - API NestJS
   - Port : 3000
   - Framework : NestJS avec Prisma
   - Base de données : PostgreSQL

3. **python-server** - Serveur de streaming audio
   - Port : 8000
   - Technologie : Python avec aiohttp
   - Fonctionnalité : Streaming audio en temps réel

4. **frontend** - Application React/Vite
   - Port : 5173
   - Framework : React avec Vite
   - UI : Tailwind CSS + Shadcn/ui

5. **nginx** - Reverse proxy (optionnel)
   - Port : 80 (HTTP), 443 (HTTPS)
   - Fonctionnalité : Load balancing et SSL

## 🔧 Commandes utiles

### Gestion des services
```bash
# Démarrer tous les services
docker-compose up

# Démarrer en arrière-plan
docker-compose up -d

# Arrêter tous les services
docker-compose down

# Redémarrer un service spécifique
docker-compose restart backend

# Voir les logs
docker-compose logs -f

# Voir les logs d'un service spécifique
docker-compose logs -f backend
```

### Base de données
```bash
# Accéder à la base de données
docker-compose exec postgres psql -U prospec_user -d prospec_db

# Exécuter les migrations Prisma
docker-compose exec backend npx prisma migrate deploy

# Générer le client Prisma
docker-compose exec backend npx prisma generate
```

### Développement
```bash
# Reconstruire un service spécifique
docker-compose build backend

# Reconstruire et redémarrer
docker-compose up --build backend

# Accéder au shell d'un conteneur
docker-compose exec backend sh
docker-compose exec frontend sh
```

## 🔒 Variables d'environnement

### Backend (.env)
```env
DATABASE_URL=postgresql://prospec_user:prospec_password@postgres:5432/prospec_db
JWT_SECRET=your_jwt_secret_here
NODE_ENV=production
PORT=3000
CORS_ORIGIN=http://localhost:5173,http://frontend:5173
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000
VITE_SERVER_HOST=localhost
VITE_API_PORT=3000
VITE_PYTHON_SERVER_URL=http://localhost:8000
```

## 📊 Monitoring

### Vérifier l'état des services
```bash
docker-compose ps
```

### Utilisation des ressources
```bash
docker stats
```

### Logs en temps réel
```bash
# Tous les services
docker-compose logs -f

# Service spécifique
docker-compose logs -f backend
```

## 🛠️ Développement

### Mode développement
```bash
# Démarrer seulement la base de données
docker-compose up postgres

# Développer en local avec la DB Docker
npm run dev  # Frontend
cd backend && npm run start:dev  # Backend
```

### Hot reload
Les volumes sont configurés pour permettre le hot reload :
- `./backend:/app` - Code backend
- `./moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b:/app` - Code frontend

## 🔧 Configuration avancée

### SSL/HTTPS
1. Créer les certificats SSL
2. Décommenter la section HTTPS dans `nginx/nginx.conf`
3. Placer les certificats dans `nginx/ssl/`

### Optimisation des performances
```bash
# Utiliser BuildKit pour des builds plus rapides
export DOCKER_BUILDKIT=1

# Construire avec cache
docker-compose build --parallel
```

### Sauvegarde de la base de données
```bash
# Sauvegarder
docker-compose exec postgres pg_dump -U prospec_user prospec_db > backup.sql

# Restaurer
docker-compose exec -T postgres psql -U prospec_user prospec_db < backup.sql
```

## 🚨 Dépannage

### Problèmes courants

1. **Port déjà utilisé**
   ```bash
   # Vérifier les ports utilisés
   netstat -tulpn | grep :3000
   
   # Changer les ports dans docker-compose.yml
   ```

2. **Base de données ne démarre pas**
   ```bash
   # Vérifier les logs
   docker-compose logs postgres
   
   # Supprimer le volume et redémarrer
   docker-compose down -v
   docker-compose up postgres
   ```

3. **Permissions Docker**
   ```bash
   # Ajouter l'utilisateur au groupe docker
   sudo usermod -aG docker $USER
   ```

4. **Mémoire insuffisante**
   ```bash
   # Augmenter la mémoire Docker
   # Dans Docker Desktop > Settings > Resources
   ```

## 📝 Notes importantes

- Les données PostgreSQL sont persistées dans un volume Docker
- Les logs sont disponibles via `docker-compose logs`
- Le frontend utilise nginx pour servir les fichiers statiques
- Les WebSockets sont correctement configurés pour le streaming audio
- Le reverse proxy nginx gère le routing entre les services

## 🔄 Mise à jour

```bash
# Arrêter les services
docker-compose down

# Récupérer les dernières modifications
git pull

# Reconstruire et redémarrer
docker-compose up --build -d
``` 