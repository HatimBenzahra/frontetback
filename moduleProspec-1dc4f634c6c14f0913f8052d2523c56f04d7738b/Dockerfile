# Utiliser l'image Node.js officielle avec Alpine Linux
FROM node:18-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de configuration
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.js ./
COPY postcss.config.cjs ./

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY . .

# Construire l'application pour la production
RUN npm run build

# Utiliser un serveur léger pour servir l'application
FROM nginx:alpine

# Copier les fichiers construits
COPY --from=0 /app/dist /usr/share/nginx/html

# Copier la configuration nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exposer le port
EXPOSE 5173

# Script de démarrage
CMD ["nginx", "-g", "daemon off;"] 