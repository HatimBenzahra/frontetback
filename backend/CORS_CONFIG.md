# Configuration CORS

## Variables d'environnement OBLIGATOIRES

⚠️ **IMPORTANT** : Aucune adresse IP n'est hardcodée. Toutes les origines CORS doivent être définies dans le fichier `.env` :

```bash
# OBLIGATOIRE - URL du frontend pour les liens de configuration
FRONTEND_URL=http://192.168.1.100:5173

# OBLIGATOIRE - IP locale pour le développement
LOCAL_IP=192.168.1.100
FRONTEND_PORT=5173

# OPTIONNEL - Configuration production
PRODUCTION_IP=your-production-domain.com
STAGING_IP=staging.your-domain.com

# Port de l'API
API_PORT=3000
```

## Origines CORS autorisées (STRICTEMENT depuis .env)

Le serveur autorise UNIQUEMENT ces origines définies dans le `.env` :

1. **IP locale (depuis .env)** :
   - `http://{LOCAL_IP}:{FRONTEND_PORT}`
   - `https://{LOCAL_IP}:{FRONTEND_PORT}`

2. **Production (depuis .env)** :
   - `http://{PRODUCTION_IP}`
   - `https://{PRODUCTION_IP}`
   - `http://{STAGING_IP}`
   - `https://{STAGING_IP}`

3. **Réseau local** :
   - Toutes les IPs `192.168.x.x` (regex automatique)

## Utilisation du script change-ip.sh

Le script `change-ip.sh` met automatiquement à jour les variables d'environnement :

```bash
./change-ip.sh 192.168.1.100
```

Cela met à jour :
- `LOCAL_IP=192.168.1.100` dans `backend/.env`
- `VITE_LOCAL_IP=192.168.1.100` dans `frontend/.env`

## Logs de démarrage

Au démarrage du serveur, vous verrez :
```
🚀 HTTPS Server running on https://localhost:3000
🌐 CORS Origins: 192.168.1.100:5173, your-production-domain.com
```

⚠️ **Si vous voyez "None configured"**, cela signifie que les variables d'environnement ne sont pas définies dans le `.env`.
