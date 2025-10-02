# Améliorations de scalabilité pour le système de transcription

## Problèmes identifiés

### 1. Sauvegarde automatique bloquante (ligne 132-149 events.gateway.ts)
- **Problème** : Boucle `for...of` avec `await` séquentiel
- **Impact** : 50 commerciaux = 10+ secondes de sauvegarde toutes les 30s
- **Solution** : Paralléliser avec `Promise.all()`

### 2. Pas de queue pour le traitement IA
- **Problème** : Tous les appels IA lancés simultanément
- **Impact** : Rate limit Gemini (60 req/min) atteint rapidement
- **Solution** : Implémenter une queue avec Bull (Redis)

### 3. Pas de persistance des sessions actives
- **Problème** : Map en mémoire uniquement
- **Impact** : Redémarrage = perte de données
- **Solution** : Redis pour les sessions actives

### 4. Pas de monitoring
- **Problème** : Impossible de voir les goulots d'étranglement
- **Solution** : Métriques et logs structurés

## Implémentation recommandée

### Priorité 1 : Paralléliser les sauvegardes (URGENT)
### Priorité 2 : Queue IA avec rate limiting
### Priorité 3 : Persistance Redis
### Priorité 4 : Monitoring et alertes

