# Utiliser l'image Python officielle avec Alpine Linux pour une taille réduite
FROM python:3.11-alpine

# Définir le répertoire de travail
WORKDIR /app

# Installer les dépendances système nécessaires pour AWS Ubuntu
RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev \
    openssl-dev \
    pkgconfig \
    # Dépendances pour aiortc et av
    ffmpeg-dev \
    # Dépendances pour les processus système
    procps \
    # Dépendances pour la gestion des logs
    logrotate \
    # Dépendances pour la gestion des certificats
    ca-certificates \
    # Dépendances pour la gestion des timeouts
    curl \
    && rm -rf /var/cache/apk/*

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S pythonuser && \
    adduser -u 1001 -S pythonuser -G pythonuser

# Copier le fichier requirements.txt en premier pour optimiser le cache Docker
COPY requirements.txt .

# Installer les dépendances Python avec des optimisations
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copier le code source
COPY . .

# Créer les répertoires nécessaires
RUN mkdir -p /app/logs /app/certs /app/temp && \
    chown -R pythonuser:pythonuser /app

# Exposer le port
EXPOSE 8000

# Variables d'environnement par défaut
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV HOST=0.0.0.0
ENV PORT=8000
ENV LOG_LEVEL=INFO
ENV ENVIRONMENT=production

# Script de démarrage avec gestion d'erreurs
COPY scripts/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Changer vers l'utilisateur non-root
USER pythonuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Script de démarrage
CMD ["/app/start.sh"] 