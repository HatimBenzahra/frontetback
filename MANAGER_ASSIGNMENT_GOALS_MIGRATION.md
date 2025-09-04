# Migration des Assignment Goals vers l'espace Manager

## Résumé des modifications

Cette migration a copié et adapté le module assignment-goals de l'espace admin vers l'espace manager, en créant une version spécialisée pour les managers.

## Fichiers créés

### Backend (Manager-Space)

1. **Service** : `/backend/src/manager-space/assignment-goals/assignment-goals.service.ts`
   - Service spécialisé pour les managers
   - Méthodes limitées aux ressources du manager
   - Vérifications de permissions intégrées

2. **Contrôleur** : `/backend/src/manager-space/assignment-goals/assignment-goals.controller.ts`
   - Endpoints spécifiques au manager-space
   - Routes préfixées par `/manager-space/assignment-goals/`
   - Authentification et autorisation pour les managers

3. **Module** : `/backend/src/manager-space/assignment-goals/assignment-goals.module.ts`
   - Module NestJS pour l'espace manager
   - Intégration avec PrismaModule et AuthModule

4. **Mise à jour** : `/backend/src/manager-space/manager-space.module.ts`
   - Ajout du ManagerAssignmentGoalsModule

### Frontend

1. **Service utilisé** : `/moduleProspec-.../src/services/manager-zone.service.ts`
   - Service existant pour les zones du manager
   - Utilisé en combinaison avec les services existants (commercial, equipe, assignment-goals)

2. **Pages copiées et adaptées** :
   - `/moduleProspec-.../src/pages/manager/assignment-goals/AssignmentGoalsPage.tsx`
   - `/moduleProspec-.../src/pages/manager/assignment-goals/ZoneAssignmentPage.tsx`
   - `/moduleProspec-.../src/pages/manager/assignment-goals/GlobalGoalsPage.tsx`
   - `/moduleProspec-.../src/pages/manager/assignment-goals/utils.ts`

3. **Composant spécialisé** : `/moduleProspec-.../src/components/page-components/ManagerZoneAssignmentCard.tsx`
   - Version adaptée du ZoneAssignmentCard pour les managers
   - Suppression de l'option "Manager" dans les types d'assignation
   - Interface limitée aux commerciaux et équipes uniquement

## Fonctionnalités adaptées

### Limitations pour les managers

1. **Assignations** :
   - Les managers ne peuvent assigner que leurs propres zones
   - Limitation aux équipes et commerciaux qu'ils gèrent
   - Impossible d'assigner à d'autres managers (option supprimée de l'interface)
   - Interface simplifiée avec seulement 2 options : Commercial et Équipe

2. **Objectifs globaux** :
   - Lecture seule des objectifs globaux
   - Impossible de définir de nouveaux objectifs (réservé aux admins)

3. **Permissions** :
   - Vérification automatique des permissions dans le backend
   - Accès limité aux données du manager uniquement

### Endpoints API Manager-Space

- `GET /manager-space/assignment-goals/assignments` - Assignations du manager
- `GET /manager-space/assignment-goals/history` - Historique des assignations
- `GET /manager-space/assignment-goals/zones` - Zones du manager
- `GET /manager-space/assignment-goals/commercials` - Commerciaux du manager
- `GET /manager-space/assignment-goals/equipes` - Équipes du manager
- `POST /manager-space/assignment-goals/assign-zone` - Assigner une zone
- `PATCH /manager-space/assignment-goals/stop-assignment/:id` - Arrêter une assignation
- `GET /manager-space/assignment-goals/global-goal/current` - Objectif global actuel

## Différences avec l'espace admin

1. **Scope des données** : Limité aux ressources du manager
2. **Permissions** : Vérifications strictes des droits d'accès
3. **Fonctionnalités** : Certaines fonctionnalités admin désactivées
4. **Interface** : Adaptation de l'UI pour refléter les limitations

## Utilisation

Les managers peuvent maintenant accéder à leurs assignations et objectifs via l'interface manager, avec des fonctionnalités adaptées à leur rôle et leurs permissions.

## Sécurité

- Authentification JWT requise
- Rôle 'manager' obligatoire
- Vérifications de permissions au niveau service
- Isolation des données par manager
