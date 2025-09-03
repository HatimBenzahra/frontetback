#!/bin/bash

# Script pour changer l'IP dans tous les fichiers de configuration
# Usage: ./change-ip.sh <nouvelle_ip>

if [ $# -eq 0 ]; then
    echo "Usage: $0 <nouvelle_ip>"
    echo "Exemple: $0 192.168.1.100"
    exit 1
fi

NEW_IP=$1
echo "🔄 Changement de l'IP vers: $NEW_IP"

# Backup des fichiers .env
#echo "📦 Création des sauvegardes..."
#cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S)
#cp moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/.env moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/.env.backup.$(date +%Y%m%d_%H%M%S)

# Mise à jour du backend .env
echo "🔧 Mise à jour backend/.env..."
sed -i '' "s/LOCAL_IP=.*/LOCAL_IP=$NEW_IP/" backend/.env

# Mise à jour du frontend .env
echo "🔧 Mise à jour frontend/.env..."
sed -i '' "s/VITE_LOCAL_IP=.*/VITE_LOCAL_IP=$NEW_IP/" moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/.env

echo "✅ IP changée avec succès vers $NEW_IP"
echo "🔄 Redémarrage des serveurs nécessaire..."
echo ""
echo "Pour redémarrer les serveurs:"
echo "1. Backend: cd backend && npm run start:dev"
echo "2. Frontend: cd moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b && npm run dev"
