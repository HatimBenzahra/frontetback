#!/bin/bash

# Script pour générer les certificats SSL pour Docker
echo "🔐 Génération des certificats SSL pour Docker..."

# Créer les dossiers ssl 
mkdir -p ssl
mkdir -p nginx/ssl

# Générer une clé privée
echo "🔑 Génération de la clé privée..."
openssl genrsa -out ssl/key.pem 2048

# Générer le certificat auto-signé avec SAN
echo "📜 Génération du certificat auto-signé..."
openssl req -new -x509 -key ssl/key.pem -out ssl/cert.pem -days 365 \
  -subj "/C=FR/ST=Paris/L=Paris/O=Prospec/OU=IT/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:prospec_backend,DNS:prospec_frontend,DNS:prospec_nginx,IP:127.0.0.1,IP:192.168.1.50"

# Copier vers nginx/ssl avec les noms attendus
cp ssl/cert.pem nginx/ssl/cert.pem 
cp ssl/key.pem nginx/ssl/key.pem

# Générer DH params pour nginx
echo "🔐 Génération des paramètres DH..."
openssl dhparam -out nginx/ssl/dhparam.pem 2048

# Définir les permissions appropriées
chmod 600 ssl/key.pem nginx/ssl/key.pem
chmod 644 ssl/cert.pem nginx/ssl/cert.pem
chmod 644 nginx/ssl/dhparam.pem

echo "✅ Certificats SSL générés avec succès!"
echo "📁 Fichiers créés:"
echo "   - ssl/cert.pem & nginx/ssl/cert.pem (certificat public)"
echo "   - ssl/key.pem & nginx/ssl/key.pem (clé privée)"
echo "   - nginx/ssl/dhparam.pem (paramètres DH)"
echo ""
echo "🔒 SAN inclus:"
echo "   - localhost, prospec_backend, prospec_frontend, prospec_nginx"
echo "   - 127.0.0.1, 192.168.1.50"
echo ""
echo "⚠️  Note: Certificats auto-signés pour le développement."