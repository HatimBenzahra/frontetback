# Configuration Email

## Variables d'environnement requises

Pour que les emails de configuration de mot de passe fonctionnent, ajoutez ces variables dans votre fichier `.env` :

```bash
# Configuration SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# URL du frontend pour les liens d'email
FRONTEND_URL=http://192.168.1.100:5173

# OU utilisez l'IP locale automatique
LOCAL_IP=192.168.1.100
FRONTEND_PORT=5173
```

## Logique de génération des liens

Le système utilise cette priorité pour générer les liens d'email :

1. **FRONTEND_URL** (si définie) : `http://192.168.1.100:5173`
2. **IP locale automatique** (si LOCAL_IP définie) : `http://{LOCAL_IP}:{FRONTEND_PORT}`
3. **Fallback localhost** : `http://localhost:5173`

## Exemple de configuration

### Option 1 : URL complète
```bash
FRONTEND_URL=http://192.168.1.100:5173
```

### Option 2 : IP automatique (recommandée)
```bash
LOCAL_IP=192.168.1.100
FRONTEND_PORT=5173
```

## Logs de débogage

Au démarrage du serveur et lors de la création d'utilisateurs, vous verrez :

```
🚀 HTTPS Server running on https://localhost:3000
🌐 CORS Origins: localhost:5173, 127.0.0.1:5173, 192.168.1.100:5173
Setup link generated: http://192.168.1.100:5173/setup-password?token=...
```

## Configuration Gmail

Pour utiliser Gmail comme serveur SMTP :

1. Activez l'authentification à 2 facteurs
2. Générez un mot de passe d'application
3. Utilisez ces paramètres :

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
```

## Test des emails

Pour tester la configuration email :

1. Créez un utilisateur via l'interface admin
2. Vérifiez les logs pour voir le lien généré
3. Vérifiez que l'email est reçu
4. Testez le lien de configuration

## Dépannage

### Problème : "undefined" dans les liens
- Vérifiez que `LOCAL_IP` ou `FRONTEND_URL` est définie
- Redémarrez le serveur après modification du .env

### Problème : Email non reçu
- Vérifiez la configuration SMTP
- Vérifiez les logs d'erreur
- Testez avec un autre fournisseur email

### Problème : Lien ne fonctionne pas
- Vérifiez que l'IP correspond à celle du frontend
- Vérifiez la configuration CORS
- Vérifiez que le frontend est accessible sur cette IP
