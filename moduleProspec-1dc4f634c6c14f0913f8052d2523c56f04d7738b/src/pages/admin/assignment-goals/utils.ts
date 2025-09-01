// Utility functions for Assignment Goals pages

// Utils - fonction de mapping des zones avec vraies données
export function mapApiZonesToUiZones(zones: any[]): any[] {
  return zones.map((zone) => ({
    id: zone.id,
    name: zone.nom,
    assignedTo: '',
    color: zone.couleur,
    latlng: [zone.latitude, zone.longitude] as [number, number],
    radius: zone.rayonMetres,
    dateCreation: zone.createdAt,
    nbImmeubles: zone.stats?.nbImmeubles || 0,
    totalContratsSignes: zone.stats?.totalContratsSignes || 0,
    totalRdvPris: zone.stats?.totalRdvPris || 0,
  }));
}

// Fonction pour normaliser le nom d'utilisateur avec le rôle
export function normalizeUserName(user: any) {
  if (!user) return 'Utilisateur Inconnu';
  
  let displayName = '';
  
  // Si l'utilisateur a un nom déjà formaté
  if (user.name && user.name.trim()) {
    displayName = user.name.trim();
  }
  // Si l'utilisateur a firstName et lastName
  else if (user.firstName || user.lastName) {
    displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  }
  // Si l'utilisateur a un email, utiliser la partie avant @
  else if (user.email) {
    displayName = user.email.split('@')[0];
  }
  else {
    displayName = 'Utilisateur Inconnu';
  }
  
  // Ajouter le rôle si disponible
  if (user.role && displayName !== 'Utilisateur Inconnu') {
    const roleLabels: { [key: string]: string } = {
      'admin': 'Administrateur',
      'manager': 'Manager',
      'directeur': 'Directeur',
      'backoffice': 'Backoffice',
      'commercial': 'Commercial'
    };
    
    const roleLabel = roleLabels[user.role] || user.role;
    return `${displayName} (${roleLabel})`;
  }
  
  return displayName;
}

// Fonction pour normaliser l'affichage des noms dans l'historique
export function normalizeDisplayName(userName: string) {
  if (!userName) return 'Utilisateur Inconnu';
  
  // Normaliser les variations courantes
  const normalized = userName.trim();
  
  // Remplacer les variations de "Admin System" par "Administrateur"
  if (normalized.toLowerCase().includes('admin system') || 
      normalized.toLowerCase().includes('system admin') ||
      normalized.toLowerCase().includes('admin')) {
    return 'Administrateur';
  }
  
  // Remplacer les variations de "Utilisateur Inconnu"
  if (normalized.toLowerCase().includes('utilisateur inconnu') ||
      normalized.toLowerCase().includes('unknown user')) {
    return 'Utilisateur Inconnu';
  }
  
  // Si le nom contient déjà un rôle entre parenthèses, le garder
  if (normalized.includes('(') && normalized.includes(')')) {
    return normalized;
  }
  
  // Essayer de détecter le rôle à partir du nom
  const rolePatterns = [
    { pattern: /admin/i, label: 'Administrateur' },
    { pattern: /manager/i, label: 'Manager' },
    { pattern: /directeur/i, label: 'Directeur' },
    { pattern: /backoffice/i, label: 'Backoffice' },
    { pattern: /commercial/i, label: 'Commercial' }
  ];
  
  for (const { pattern, label } of rolePatterns) {
    if (pattern.test(normalized)) {
      // Extraire le nom sans le rôle
      const nameWithoutRole = normalized.replace(pattern, '').trim();
      if (nameWithoutRole) {
        return `${nameWithoutRole} (${label})`;
      }
      return label;
    }
  }
  
  return normalized;
}

// Fonction pour calculer les contrats signés réels d'un commercial
export function getRealContractsSigned(commercial: any) {
  if (!commercial.historiques || !Array.isArray(commercial.historiques)) {
    return 0;
  }
  return commercial.historiques.reduce((total: number, historique: any) => {
    return total + (historique.nbContratsSignes || 0);
  }, 0);
}