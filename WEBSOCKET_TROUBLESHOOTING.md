# Guide de dépannage WebSocket

## Erreurs courantes et solutions

### 1. "WebSocket is closed before the connection is established"

**Cause :** La connexion WebSocket se ferme avant d'être complètement établie.

**Solutions :**
- ✅ **Corrigé** : Amélioration de la logique de reconnexion dans `useSocket.ts`
- ✅ **Corrigé** : Ajout de `rejectUnauthorized: false` pour accepter les certificats auto-signés
- ✅ **Corrigé** : Utilisation de `polling` en premier transport pour une meilleure compatibilité

### 2. "InvalidStateError: Failed to set remote answer sdp"

**Cause :** Tentative de définir une description WebRTC dans un état de signalisation incorrect.

**Solutions :**
- ✅ **Corrigé** : Vérification de l'état de signalisation avant `setRemoteDescription`
- ✅ **Corrigé** : Gestion des erreurs avec nettoyage des connexions en échec

### 3. "Vous n'avez pas l'autorisation d'accéder à la ressource requise"

**Cause :** Problèmes d'autorisation CORS ou de certificats SSL.

**Solutions :**
- Vérifier la configuration CORS dans le backend
- S'assurer que les certificats SSL sont correctement configurés
- Vérifier que l'IP `192.168.1.50` est autorisée dans la configuration

## Configuration recommandée

### Variables d'environnement
```bash
VITE_SERVER_HOST=192.168.1.50
VITE_API_PORT=3000
VITE_SSL_CERT_NAME=127.0.0.1+4
```

### Configuration WebSocket optimisée
```typescript
const socketOptions = {
  secure: true,
  transports: ['polling', 'websocket'], // Polling en premier
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  forceNew: true,
  rejectUnauthorized: false, // Pour les certificats auto-signés
};
```

## Améliorations apportées

### 1. Hook `useSocket` amélioré
- Gestion d'état de connexion
- Logs de débogage
- Gestion d'erreurs robuste
- Évite les reconnexions multiples

### 2. Hook `useGlobalSocket` créé
- Instance WebSocket globale partagée
- Évite les connexions multiples
- Gestion centralisée des rooms
- Configuration centralisée

### 3. Configuration centralisée
- Fichier `websocket.config.ts` pour tous les paramètres
- Constantes réutilisables
- Fonctions utilitaires

### 4. Gestion WebRTC améliorée
- Vérification des états de signalisation
- Nettoyage automatique des connexions en échec
- Logs de débogage pour le diagnostic

## Vérifications à effectuer

1. **Backend en cours d'exécution** : Vérifier que le serveur backend est accessible sur `https://192.168.1.50:3000`

2. **Certificats SSL** : S'assurer que les certificats sont présents dans le dossier `ssl/`

3. **Configuration CORS** : Vérifier que l'IP `192.168.1.50` est autorisée dans la configuration CORS du backend

4. **Token d'authentification** : Vérifier que le token est présent dans `localStorage`

## Commandes de débogage

```javascript
// Dans la console du navigateur
console.log('WebSocket URL:', window.location.protocol + '//' + window.location.hostname + ':3000');
console.log('Auth token:', localStorage.getItem('access_token'));
```

## Logs à surveiller

- `🔌 WebSocket connected` : Connexion réussie
- `🔌 WebSocket disconnected` : Déconnexion
- `🔌 WebSocket connection error` : Erreur de connexion
- `WebRTC connection state` : État des connexions WebRTC
