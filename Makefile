# Makefile pour le projet Prospec Docker

.PHONY: help build up down restart logs clean dev prod backup restore

# Variables
COMPOSE_FILE = docker-compose.yml
PROJECT_NAME = prospec

# Aide
help:
	@echo "🐳 Commandes Docker pour Prospec"
	@echo ""
	@echo "📋 Commandes principales:"
	@echo "  make build    - Construire tous les services"
	@echo "  make up       - Démarrer tous les services"
	@echo "  make down     - Arrêter tous les services"
	@echo "  make restart  - Redémarrer tous les services"
	@echo "  make logs     - Voir les logs en temps réel"
	@echo ""
	@echo "🔧 Développement:"
	@echo "  make dev      - Démarrer en mode développement"
	@echo "  make prod     - Démarrer en mode production"
	@echo "  make clean    - Nettoyer les conteneurs et volumes"
	@echo ""
	@echo "💾 Base de données:"
	@echo "  make backup   - Sauvegarder la base de données"
	@echo "  make restore  - Restaurer la base de données"
	@echo ""
	@echo "🔍 Monitoring:"
	@echo "  make status   - Vérifier l'état des services"
	@echo "  make stats    - Voir l'utilisation des ressources"

# Construction
build:
	@echo "🔨 Construction des images Docker..."
	docker-compose -f $(COMPOSE_FILE) build

# Démarrage
up:
	@echo "🚀 Démarrage des services..."
	docker-compose -f $(COMPOSE_FILE) up -d

# Arrêt
down:
	@echo "🛑 Arrêt des services..."
	docker-compose -f $(COMPOSE_FILE) down

# Redémarrage
restart:
	@echo "🔄 Redémarrage des services..."
	docker-compose -f $(COMPOSE_FILE) restart

# Logs
logs:
	@echo "📋 Affichage des logs..."
	docker-compose -f $(COMPOSE_FILE) logs -f

# Nettoyage
clean:
	@echo "🧹 Nettoyage des conteneurs et volumes..."
	docker-compose -f $(COMPOSE_FILE) down -v --remove-orphans
	docker system prune -f

# Mode développement
dev:
	@echo "👨‍💻 Démarrage en mode développement..."
	docker-compose -f $(COMPOSE_FILE) up -d postgres
	@echo "✅ Base de données démarrée. Vous pouvez maintenant lancer:"
	@echo "   Frontend: npm run dev"
	@echo "   Backend: cd backend && npm run start:dev"

# Mode production
prod:
	@echo "🏭 Démarrage en mode production..."
	docker-compose -f $(COMPOSE_FILE) up -d --build

# Sauvegarde de la base de données
backup:
	@echo "💾 Sauvegarde de la base de données..."
	@mkdir -p backups
	docker-compose -f $(COMPOSE_FILE) exec -T postgres pg_dump -U prospec_user prospec_db > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "✅ Sauvegarde créée dans backups/"

# Restauration de la base de données
restore:
	@echo "📥 Restauration de la base de données..."
	@if [ -z "$(FILE)" ]; then \
		echo "❌ Veuillez spécifier le fichier de sauvegarde: make restore FILE=backups/backup_20231201_120000.sql"; \
		exit 1; \
	fi
	docker-compose -f $(COMPOSE_FILE) exec -T postgres psql -U prospec_user prospec_db < $(FILE)
	@echo "✅ Base de données restaurée"

# État des services
status:
	@echo "📊 État des services:"
	docker-compose -f $(COMPOSE_FILE) ps

# Statistiques des ressources
stats:
	@echo "📈 Utilisation des ressources:"
	docker stats --no-stream

# Migration de la base de données
migrate:
	@echo "🔄 Exécution des migrations Prisma..."
	docker-compose -f $(COMPOSE_FILE) exec backend npx prisma migrate deploy

# Génération du client Prisma
prisma-generate:
	@echo "🔧 Génération du client Prisma..."
	docker-compose -f $(COMPOSE_FILE) exec backend npx prisma generate

# Shell dans un conteneur
shell-backend:
	@echo "🐚 Ouverture du shell backend..."
	docker-compose -f $(COMPOSE_FILE) exec backend sh

shell-frontend:
	@echo "🐚 Ouverture du shell frontend..."
	docker-compose -f $(COMPOSE_FILE) exec frontend sh

shell-postgres:
	@echo "🐚 Ouverture du shell PostgreSQL..."
	docker-compose -f $(COMPOSE_FILE) exec postgres psql -U prospec_user -d prospec_db

# Rebuild d'un service spécifique
rebuild-backend:
	@echo "🔨 Reconstruction du backend..."
	docker-compose -f $(COMPOSE_FILE) build backend
	docker-compose -f $(COMPOSE_FILE) up -d backend

rebuild-frontend:
	@echo "🔨 Reconstruction du frontend..."
	docker-compose -f $(COMPOSE_FILE) build frontend
	docker-compose -f $(COMPOSE_FILE) up -d frontend

# Logs spécifiques
logs-backend:
	@echo "📋 Logs du backend:"
	docker-compose -f $(COMPOSE_FILE) logs -f backend

logs-frontend:
	@echo "📋 Logs du frontend:"
	docker-compose -f $(COMPOSE_FILE) logs -f frontend

logs-postgres:
	@echo "📋 Logs de PostgreSQL:"
	docker-compose -f $(COMPOSE_FILE) logs -f postgres

# Vérification de la santé des services
health:
	@echo "🏥 Vérification de la santé des services..."
	@echo "📊 PostgreSQL:"
	@docker-compose -f $(COMPOSE_FILE) exec postgres pg_isready -U prospec_user -d prospec_db || echo "❌ PostgreSQL non disponible"
	@echo "📊 Backend:"
	@curl -f http://localhost:3000/health || echo "❌ Backend non disponible"
	@echo "📊 Frontend:"
	@curl -f http://localhost:5173 || echo "❌ Frontend non disponible"

# Installation complète
install:
	@echo "🚀 Installation complète du projet Prospec..."
	@echo "📦 Construction des images..."
	make build
	@echo "🏭 Démarrage en mode production..."
	make prod
	@echo "⏳ Attente du démarrage des services..."
	@sleep 30
	@echo "🔄 Exécution des migrations..."
	make migrate
	@echo "✅ Installation terminée!"
	@echo "🌐 Accédez à l'application: http://localhost:5173" 