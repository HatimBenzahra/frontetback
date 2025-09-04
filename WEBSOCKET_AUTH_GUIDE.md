# Guide d'Authentification WebSocket

## Résumé des modifications

L'authentification a été appliquée à tous les WebSockets du projet pour sécuriser les connexions et s'assurer que seuls les utilisateurs authentifiés peuvent accéder aux événements WebSocket.

## Modifications Backend

### 1. Nouveaux Guards WebSocket

- **`WsAuthGuard`** : Guard d'authentification WebSocket qui réutilise le `JwtAuthGuard` existant
- **`WsRolesGuard`** : Guard de rôles WebSocket qui réutilise le `RolesGuard` existant

### 2. Guards appliqués aux Gateways

Tous les gateways ont été sécurisés :
- `EventsGateway` : Authentification + rôles spécifiques par méthode
- `GpsGateway` : Authentification + rôles commercial/admin/manager
- `AudioGateway` : Authentification
- `PortesGateway` : Authentification
- `DuoGateway` : Authentification
- `TranscriptionGateway` : Authentification
- `UtilsGateway` : Authentification

### 3. Configuration des modules

Tous les modules de gateways importent maintenant le `AuthModule` pour accéder aux guards.

## Modifications Frontend

### 1. Hook useSocket

Le hook `useSocket` a été modifié pour inclure le token d'authentification :
- Token récupéré depuis `localStorage.getItem('access_token')`
- Token envoyé via `auth.token` et `query.token`

### 2. Service Location

Le `LocationService` a été mis à jour pour inclure l'authentification WebSocket.

## Comment ça fonctionne

### Authentification WebSocket

1. **Côté Client** : Le token JWT est envoyé lors de la connexion WebSocket
2. **Côté Serveur** : Le `WsAuthGuard` intercepte la connexion et valide le token
3. **Validation** : Le token est vérifié avec le même système que les API REST
4. **Autorisation** : L'utilisateur est attaché au client WebSocket pour les vérifications de rôles

### Gestion des rôles

- **Admin** : Accès complet à tous les événements
- **Manager** : Accès aux données de leurs commerciaux uniquement
- **Commercial** : Accès à leurs propres données (GPS, transcriptions, etc.)

## Points d'attention

### 1. Token Expiration

Si un token expire pendant une session WebSocket active, la connexion sera fermée. Le frontend doit gérer la reconnexion avec un nouveau token.

### 2. Gestion des erreurs

Les erreurs d'authentification WebSocket sont loggées côté serveur et la connexion est fermée avec une `UnauthorizedException`.

### 3. Performance

L'authentification WebSocket réutilise le cache existant du `JwtAuthGuard` pour éviter les requêtes répétées à la base de données.

## Tests recommandés

1. **Test de connexion authentifiée** : Vérifier qu'un utilisateur avec token valide peut se connecter
2. **Test de connexion non-authentifiée** : Vérifier qu'un utilisateur sans token est rejeté
3. **Test d'expiration de token** : Vérifier le comportement quand le token expire
4. **Test des rôles** : Vérifier que les restrictions de rôles fonctionnent correctement
5. **Test de performance** : Vérifier que l'authentification n'impacte pas significativement les performances

## Commandes de test

```bash
# Compiler le backend
cd backend && npm run build

# Démarrer le backend
cd backend && npm run start:dev

# Compiler le frontend
cd moduleProspec-* && npm run build

# Démarrer le frontend
cd moduleProspec-* && npm run dev
```

## Debugging

Pour débogger l'authentification WebSocket :

1. Vérifier les logs du serveur pour les messages de `WsAuthGuard`
2. Vérifier la console du navigateur pour les erreurs de connexion WebSocket
3. S'assurer que le token est présent dans le localStorage du navigateur
4. Vérifier que les headers Authorization sont correctement configurés

## Sécurité

- ✅ Tous les WebSockets sont maintenant authentifiés
- ✅ Les rôles sont vérifiés pour les opérations sensibles
- ✅ Pas de duplication de code d'authentification
- ✅ Réutilisation des guards existants
- ✅ Logging des tentatives d'authentification