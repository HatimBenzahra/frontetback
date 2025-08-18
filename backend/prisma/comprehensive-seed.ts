import { PrismaClient, AssignmentType, ImmeubleStatus, ProspectingMode, PorteStatut } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start comprehensive seeding for statistics and dashboard testing...`);

  // --- Managers (3 managers avec des performances différentes) ---
  const manager1 = await prisma.manager.upsert({
    where: { email: 'jean.dupont@example.com' },
    update: {},
    create: {
      nom: 'Dupont',
      prenom: 'Jean',
      email: 'jean.dupont@example.com',
      telephone: '0123456789',
    },
  });

  const manager2 = await prisma.manager.upsert({
    where: { email: 'marie.curie@example.com' },
    update: {},
    create: {
      nom: 'Curie',
      prenom: 'Marie',
      email: 'marie.curie@example.com',
      telephone: '0987654321',
    },
  });

  const manager3 = await prisma.manager.upsert({
    where: { email: 'pierre.martin@example.com' },
    update: {},
    create: {
      nom: 'Martin',
      prenom: 'Pierre',
      email: 'pierre.martin@example.com',
      telephone: '0147258369',
    },
  });

  console.log(`Created 3 managers`);

  // --- Équipes (6 équipes réparties entre les managers) ---
  const equipeAlpha = await prisma.equipe.upsert({
    where: { nom_managerId: { nom: 'Équipe Alpha', managerId: manager1.id } },
    update: {},
    create: { nom: 'Équipe Alpha', managerId: manager1.id },
  });

  const equipeBeta = await prisma.equipe.upsert({
    where: { nom_managerId: { nom: 'Équipe Beta', managerId: manager1.id } },
    update: {},
    create: { nom: 'Équipe Beta', managerId: manager1.id },
  });

  const equipeGamma = await prisma.equipe.upsert({
    where: { nom_managerId: { nom: 'Équipe Gamma', managerId: manager2.id } },
    update: {},
    create: { nom: 'Équipe Gamma', managerId: manager2.id },
  });

  const equipeDelta = await prisma.equipe.upsert({
    where: { nom_managerId: { nom: 'Équipe Delta', managerId: manager2.id } },
    update: {},
    create: { nom: 'Équipe Delta', managerId: manager2.id },
  });

  const equipeEpsilon = await prisma.equipe.upsert({
    where: { nom_managerId: { nom: 'Équipe Epsilon', managerId: manager3.id } },
    update: {},
    create: { nom: 'Équipe Epsilon', managerId: manager3.id },
  });

  const equipeZeta = await prisma.equipe.upsert({
    where: { nom_managerId: { nom: 'Équipe Zeta', managerId: manager3.id } },
    update: {},
    create: { nom: 'Équipe Zeta', managerId: manager3.id },
  });

  console.log(`Created 6 équipes`);

  // --- Commerciaux (12 commerciaux avec différents niveaux de performance) ---
  const commerciaux = [];

  // Équipe Alpha - Haute performance
  const commercialAlice = await prisma.commercial.upsert({
    where: { email: 'alice.martin@example.com' },
    update: {},
    create: {
      nom: 'Martin',
      prenom: 'Alice',
      email: 'alice.martin@example.com',
      equipeId: equipeAlpha.id,
      managerId: manager1.id,
      currentMonthlyGoal: 15,
    },
  });
  commerciaux.push(commercialAlice);

  const commercialBob = await prisma.commercial.upsert({
    where: { email: 'bob.durand@example.com' },
    update: {},
    create: {
      nom: 'Durand',
      prenom: 'Bob',
      email: 'bob.durand@example.com',
      equipeId: equipeAlpha.id,
      managerId: manager1.id,
      currentMonthlyGoal: 12,
    },
  });
  commerciaux.push(commercialBob);

  // Équipe Beta - Performance moyenne
  const commercialCharlie = await prisma.commercial.upsert({
    where: { email: 'charlie.leblanc@example.com' },
    update: {},
    create: {
      nom: 'Leblanc',
      prenom: 'Charlie',
      email: 'charlie.leblanc@example.com',
      equipeId: equipeBeta.id,
      managerId: manager1.id,
      currentMonthlyGoal: 10,
    },
  });
  commerciaux.push(commercialCharlie);

  const commercialDiana = await prisma.commercial.upsert({
    where: { email: 'diana.rousseau@example.com' },
    update: {},
    create: {
      nom: 'Rousseau',
      prenom: 'Diana',
      email: 'diana.rousseau@example.com',
      equipeId: equipeBeta.id,
      managerId: manager1.id,
      currentMonthlyGoal: 8,
    },
  });
  commerciaux.push(commercialDiana);

  // Équipe Gamma - Performance élevée
  const commercialEmma = await prisma.commercial.upsert({
    where: { email: 'emma.bernard@example.com' },
    update: {},
    create: {
      nom: 'Bernard',
      prenom: 'Emma',
      email: 'emma.bernard@example.com',
      equipeId: equipeGamma.id,
      managerId: manager2.id,
      currentMonthlyGoal: 18,
    },
  });
  commerciaux.push(commercialEmma);

  const commercialFrank = await prisma.commercial.upsert({
    where: { email: 'frank.petit@example.com' },
    update: {},
    create: {
      nom: 'Petit',
      prenom: 'Frank',
      email: 'frank.petit@example.com',
      equipeId: equipeGamma.id,
      managerId: manager2.id,
      currentMonthlyGoal: 14,
    },
  });
  commerciaux.push(commercialFrank);

  // Équipe Delta - Performance faible
  const commercialGrace = await prisma.commercial.upsert({
    where: { email: 'grace.moreau@example.com' },
    update: {},
    create: {
      nom: 'Moreau',
      prenom: 'Grace',
      email: 'grace.moreau@example.com',
      equipeId: equipeDelta.id,
      managerId: manager2.id,
      currentMonthlyGoal: 6,
    },
  });
  commerciaux.push(commercialGrace);

  const commercialHenry = await prisma.commercial.upsert({
    where: { email: 'henry.simon@example.com' },
    update: {},
    create: {
      nom: 'Simon',
      prenom: 'Henry',
      email: 'henry.simon@example.com',
      equipeId: equipeDelta.id,
      managerId: manager2.id,
      currentMonthlyGoal: 7,
    },
  });
  commerciaux.push(commercialHenry);

  // Équipe Epsilon - Performance très élevée
  const commercialIvy = await prisma.commercial.upsert({
    where: { email: 'ivy.laurent@example.com' },
    update: {},
    create: {
      nom: 'Laurent',
      prenom: 'Ivy',
      email: 'ivy.laurent@example.com',
      equipeId: equipeEpsilon.id,
      managerId: manager3.id,
      currentMonthlyGoal: 20,
    },
  });
  commerciaux.push(commercialIvy);

  const commercialJack = await prisma.commercial.upsert({
    where: { email: 'jack.lefebvre@example.com' },
    update: {},
    create: {
      nom: 'Lefebvre',
      prenom: 'Jack',
      email: 'jack.lefebvre@example.com',
      equipeId: equipeEpsilon.id,
      managerId: manager3.id,
      currentMonthlyGoal: 16,
    },
  });
  commerciaux.push(commercialJack);

  // Équipe Zeta - Performance variable
  const commercialKate = await prisma.commercial.upsert({
    where: { email: 'kate.roux@example.com' },
    update: {},
    create: {
      nom: 'Roux',
      prenom: 'Kate',
      email: 'kate.roux@example.com',
      equipeId: equipeZeta.id,
      managerId: manager3.id,
      currentMonthlyGoal: 11,
    },
  });
  commerciaux.push(commercialKate);

  const commercialLuke = await prisma.commercial.upsert({
    where: { email: 'luke.blanc@example.com' },
    update: {},
    create: {
      nom: 'Blanc',
      prenom: 'Luke',
      email: 'luke.blanc@example.com',
      equipeId: equipeZeta.id,
      managerId: manager3.id,
      currentMonthlyGoal: 9,
    },
  });
  commerciaux.push(commercialLuke);

  console.log(`Created 12 commerciaux`);

  // --- Zones (8 zones différentes) ---
  const zones: any[] = [];
  
  const zonesCentral = await prisma.zone.upsert({
    where: { nom_typeAssignation: { nom: 'Zone Centre-Ville', typeAssignation: AssignmentType.EQUIPE } },
    update: {},
    create: {
      nom: 'Zone Centre-Ville',
      latitude: 45.764043,
      longitude: 4.835659,
      rayonMetres: 1500,
      couleur: '#FF5733',
      typeAssignation: AssignmentType.EQUIPE,
      equipeId: equipeAlpha.id,
    },
  });
  zones.push(zonesCentral);

  const zoneNord = await prisma.zone.upsert({
    where: { nom_typeAssignation: { nom: 'Zone Nord', typeAssignation: AssignmentType.EQUIPE } },
    update: {},
    create: {
      nom: 'Zone Nord',
      latitude: 45.800000,
      longitude: 4.850000,
      rayonMetres: 2000,
      couleur: '#33FF57',
      typeAssignation: AssignmentType.EQUIPE,
      equipeId: equipeBeta.id,
    },
  });
  zones.push(zoneNord);

  const zoneSud = await prisma.zone.upsert({
    where: { nom_typeAssignation: { nom: 'Zone Sud', typeAssignation: AssignmentType.EQUIPE } },
    update: {},
    create: {
      nom: 'Zone Sud',
      latitude: 45.700000,
      longitude: 4.900000,
      rayonMetres: 1800,
      couleur: '#5733FF',
      typeAssignation: AssignmentType.EQUIPE,
      equipeId: equipeGamma.id,
    },
  });
  zones.push(zoneSud);

  const zoneEst = await prisma.zone.upsert({
    where: { nom_typeAssignation: { nom: 'Zone Est', typeAssignation: AssignmentType.EQUIPE } },
    update: {},
    create: {
      nom: 'Zone Est',
      latitude: 45.750000,
      longitude: 4.920000,
      rayonMetres: 1700,
      couleur: '#FF33A1',
      typeAssignation: AssignmentType.EQUIPE,
      equipeId: equipeDelta.id,
    },
  });
  zones.push(zoneEst);

  const zoneOuest = await prisma.zone.upsert({
    where: { nom_typeAssignation: { nom: 'Zone Ouest', typeAssignation: AssignmentType.EQUIPE } },
    update: {},
    create: {
      nom: 'Zone Ouest',
      latitude: 45.770000,
      longitude: 4.800000,
      rayonMetres: 1600,
      couleur: '#A133FF',
      typeAssignation: AssignmentType.EQUIPE,
      equipeId: equipeEpsilon.id,
    },
  });
  zones.push(zoneOuest);

  const zonePeripherie = await prisma.zone.upsert({
    where: { nom_typeAssignation: { nom: 'Zone Périphérie', typeAssignation: AssignmentType.EQUIPE } },
    update: {},
    create: {
      nom: 'Zone Périphérie',
      latitude: 45.720000,
      longitude: 4.870000,
      rayonMetres: 2200,
      couleur: '#33FFA1',
      typeAssignation: AssignmentType.EQUIPE,
      equipeId: equipeZeta.id,
    },
  });
  zones.push(zonePeripherie);

  // Zones assignées individuellement
  const zoneCommercialSpecial = await prisma.zone.upsert({
    where: { nom_typeAssignation: { nom: 'Zone Spéciale Alice', typeAssignation: AssignmentType.COMMERCIAL } },
    update: {},
    create: {
      nom: 'Zone Spéciale Alice',
      latitude: 45.780000,
      longitude: 4.840000,
      rayonMetres: 1200,
      couleur: '#FFAA33',
      typeAssignation: AssignmentType.COMMERCIAL,
      commercialId: commercialAlice.id,
    },
  });
  zones.push(zoneCommercialSpecial);

  const zoneManager = await prisma.zone.upsert({
    where: { nom_typeAssignation: { nom: 'Zone Manager VIP', typeAssignation: AssignmentType.MANAGER } },
    update: {},
    create: {
      nom: 'Zone Manager VIP',
      latitude: 45.790000,
      longitude: 4.860000,
      rayonMetres: 1000,
      couleur: '#AA33FF',
      typeAssignation: AssignmentType.MANAGER,
      managerId: manager1.id,
    },
  });
  zones.push(zoneManager);

  console.log(`Created 8 zones`);

  // --- Immeubles (24 immeubles répartis dans les zones) ---
  const immeubles = [];
  
  // Immeubles par zone avec différents statuts
  const adresses = [
    // Zone Centre-Ville
    { adresse: '123 Rue de la République', ville: 'Lyon', codePostal: '69002', zone: zonesCentral },
    { adresse: '456 Avenue Foch', ville: 'Lyon', codePostal: '69002', zone: zonesCentral },
    { adresse: '789 Place Bellecour', ville: 'Lyon', codePostal: '69002', zone: zonesCentral },
    
    // Zone Nord
    { adresse: '321 Boulevard de la Croix-Rousse', ville: 'Lyon', codePostal: '69004', zone: zoneNord },
    { adresse: '654 Rue Henon', ville: 'Lyon', codePostal: '69004', zone: zoneNord },
    { adresse: '987 Avenue des Brotteaux', ville: 'Lyon', codePostal: '69006', zone: zoneNord },
    
    // Zone Sud
    { adresse: '147 Avenue Jean Jaurès', ville: 'Lyon', codePostal: '69007', zone: zoneSud },
    { adresse: '258 Rue de Marseille', ville: 'Lyon', codePostal: '69007', zone: zoneSud },
    { adresse: '369 Boulevard des États-Unis', ville: 'Lyon', codePostal: '69008', zone: zoneSud },
    
    // Zone Est
    { adresse: '741 Rue Garibaldi', ville: 'Lyon', codePostal: '69003', zone: zoneEst },
    { adresse: '852 Avenue Lacassagne', ville: 'Lyon', codePostal: '69003', zone: zoneEst },
    { adresse: '963 Cours Lafayette', ville: 'Lyon', codePostal: '69003', zone: zoneEst },
    
    // Zone Ouest
    { adresse: '159 Avenue Berthelot', ville: 'Lyon', codePostal: '69007', zone: zoneOuest },
    { adresse: '267 Rue de Gerland', ville: 'Lyon', codePostal: '69007', zone: zoneOuest },
    { adresse: '375 Boulevard Yves Farge', ville: 'Lyon', codePostal: '69007', zone: zoneOuest },
    
    // Zone Périphérie
    { adresse: '483 Avenue Tony Garnier', ville: 'Lyon', codePostal: '69007', zone: zonePeripherie },
    { adresse: '591 Rue de la Villette', ville: 'Lyon', codePostal: '69003', zone: zonePeripherie },
    { adresse: '612 Avenue Felix Faure', ville: 'Lyon', codePostal: '69003', zone: zonePeripherie },
    
    // Zone Spéciale Alice
    { adresse: '734 Rue de la Paix', ville: 'Lyon', codePostal: '69002', zone: zoneCommercialSpecial },
    { adresse: '845 Avenue de la Liberté', ville: 'Lyon', codePostal: '69002', zone: zoneCommercialSpecial },
    { adresse: '956 Place des Terreaux', ville: 'Lyon', codePostal: '69001', zone: zoneCommercialSpecial },
    
    // Zone Manager VIP
    { adresse: '167 Rue Édouard Herriot', ville: 'Lyon', codePostal: '69002', zone: zoneManager },
    { adresse: '278 Quai Saint-Antoine', ville: 'Lyon', codePostal: '69002', zone: zoneManager },
    { adresse: '389 Place des Jacobins', ville: 'Lyon', codePostal: '69002', zone: zoneManager },
  ];

  const statuses = [ImmeubleStatus.A_VISITER, ImmeubleStatus.VISITE, ImmeubleStatus.RDV_PRIS, ImmeubleStatus.INACCESSIBLE];
  const prospectingModes = [ProspectingMode.SOLO, ProspectingMode.DUO];
  
  for (let i = 0; i < adresses.length; i++) {
    const addr = adresses[i];
    const status = statuses[i % statuses.length];
    const prospectingMode = prospectingModes[i % prospectingModes.length];
    const nbPortes = Math.floor(Math.random() * 15) + 5; // Entre 5 et 20 portes
    
    // Assignation des prospecteurs selon la zone
    let prospecteurs: any[] = [];
    if (addr.zone.equipeId) {
      const commerciauxEquipe = commerciaux.filter(c => c.equipeId === addr.zone.equipeId);
      if (prospectingMode === ProspectingMode.DUO && commerciauxEquipe.length >= 2) {
        prospecteurs = [commerciauxEquipe[0], commerciauxEquipe[1]];
      } else if (commerciauxEquipe.length > 0) {
        prospecteurs = [commerciauxEquipe[0]];
      }
    } else if (addr.zone.commercialId) {
      const commercial = commerciaux.find(c => c.id === addr.zone.commercialId);
      if (commercial) prospecteurs = [commercial];
    }

    const immeuble = await prisma.immeuble.create({
      data: {
        adresse: addr.adresse,
        ville: addr.ville,
        codePostal: addr.codePostal,
        status,
        nbPortesTotal: nbPortes,
        nbEtages: Math.floor(nbPortes / 4) + 1,
        nbPortesParEtage: Math.floor(nbPortes / (Math.floor(nbPortes / 4) + 1)),
        prospectingMode,
        zoneId: addr.zone.id,
        latitude: addr.zone.latitude + (Math.random() - 0.5) * 0.01,
        longitude: addr.zone.longitude + (Math.random() - 0.5) * 0.01,
        hasElevator: Math.random() > 0.4,
        digicode: Math.random() > 0.3 ? `${Math.floor(Math.random() * 9000) + 1000}` : null,
        prospectors: {
          connect: prospecteurs.map(p => ({ id: p.id })),
        },
      },
    });
    
    immeubles.push(immeuble);
    
    // Créer les portes pour chaque immeuble
    const portesData = [];
    for (let j = 1; j <= nbPortes; j++) {
      const etage = Math.floor((j - 1) / 4) + 1;
      const numeroPorte = `${etage}${String.fromCharCode(65 + ((j - 1) % 4))}`;
      
      portesData.push({
        numeroPorte,
        etage,
        statut: Object.values(PorteStatut)[Math.floor(Math.random() * Object.values(PorteStatut).length)],
        passage: Math.floor(Math.random() * 3),
        immeubleId: immeuble.id,
        assigneeId: prospecteurs.length > 0 ? prospecteurs[j % prospecteurs.length].id : null,
        commentaire: Math.random() > 0.7 ? `Commentaire porte ${numeroPorte}` : null,
      });
    }
    
    await prisma.porte.createMany({ data: portesData });
  }

  console.log(`Created 24 immeubles with portes`);

  // --- Objectifs globaux ---
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  await prisma.globalGoal.upsert({
    where: { id: 'current-month-goal' },
    update: {
      goal: 150,
      startDate: startOfMonth,
      endDate: endOfMonth,
    },
    create: {
      id: 'current-month-goal',
      goal: 150,
      startDate: startOfMonth,
      endDate: endOfMonth,
    },
  });

  console.log(`Created global goals`);

  // --- Historique de prospection détaillé (6 mois de données) ---
  const historicalEntries = [];
  
  for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
    const date = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
    
    for (let day = 1; day <= 25; day++) {
      const currentDate = new Date(date.getFullYear(), date.getMonth(), day);
      
      // Skip weekends for more realistic data
      if (currentDate.getDay() === 0 || currentDate.getDay() === 6) continue;
      
      for (let i = 0; i < commerciaux.length; i++) {
        const commercial = commerciaux[i];
        
        // Performance différenciée selon le commercial
        let basePerformance = 1;
        if (commercial.prenom === 'Alice' || commercial.prenom === 'Emma' || commercial.prenom === 'Ivy') {
          basePerformance = 1.5; // Haute performance
        } else if (commercial.prenom === 'Bob' || commercial.prenom === 'Frank' || commercial.prenom === 'Jack') {
          basePerformance = 1.2; // Bonne performance
        } else if (commercial.prenom === 'Grace' || commercial.prenom === 'Henry') {
          basePerformance = 0.7; // Performance plus faible
        }
        
        // Variation saisonnière (plus d'activité en début/fin de mois)
        const seasonalFactor = day <= 10 || day >= 20 ? 1.2 : 0.8;
        
        // Facteur aléatoire pour la variabilité
        const randomFactor = 0.5 + Math.random();
        
        const finalPerformance = basePerformance * seasonalFactor * randomFactor;
        
        // Génération de données réalistes
        const nbPortesVisitees = Math.max(1, Math.floor(finalPerformance * (3 + Math.random() * 8)));
        const nbContratsSignes = Math.floor(finalPerformance * Math.random() * 3);
        const nbRdvPris = Math.floor(finalPerformance * (Math.random() * 2));
        const nbRefus = Math.floor(nbPortesVisitees * 0.3 * Math.random());
        const nbAbsents = Math.floor(nbPortesVisitees * 0.2 * Math.random());
        const nbCurieux = Math.floor(nbPortesVisitees * 0.1 * Math.random());
        
        // Choisir un immeuble aléatoire dans la zone du commercial
        const immeublesPossibles = immeubles.filter(imm => 
          imm.zoneId === zones.find(z => z.equipeId === commercial.equipeId || z.commercialId === commercial.id)?.id
        );
        
        if (immeublesPossibles.length === 0) continue;
        
        const immeuble = immeublesPossibles[Math.floor(Math.random() * immeublesPossibles.length)];
        
        // Probabilité de générer une entrée pour ce jour (pas tous les jours)
        if (Math.random() > 0.6) {
          historicalEntries.push({
            dateProspection: currentDate,
            commercialId: commercial.id,
            immeubleId: immeuble.id,
            nbPortesVisitees,
            nbContratsSignes,
            nbRdvPris,
            nbRefus,
            nbAbsents,
            nbCurieux,
            commentaire: Math.random() > 0.5 ? 
              `Prospection ${commercial.prenom} - ${day}/${date.getMonth() + 1}` : 
              null,
          });
        }
      }
    }
  }

  await prisma.historiqueProspection.createMany({
    data: historicalEntries,
    skipDuplicates: true,
  });

  console.log(`Created ${historicalEntries.length} historical prospection entries`);

  // --- Sessions de transcription ---
  const transcriptionSessions = [];
  for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
    for (let i = 0; i < 20; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - monthOffset, Math.floor(Math.random() * 28) + 1);
      const commercial = commerciaux[Math.floor(Math.random() * commerciaux.length)];
      const immeuble = immeubles[Math.floor(Math.random() * immeubles.length)];
      
      const duration = Math.floor(Math.random() * 3600) + 300; // 5 min à 1h
      const startTime = new Date(date);
      startTime.setHours(Math.floor(Math.random() * 10) + 8); // Entre 8h et 18h
      
      const endTime = new Date(startTime.getTime() + duration * 1000);
      
      transcriptionSessions.push({
        commercial_id: commercial.id,
        commercial_name: `${commercial.prenom} ${commercial.nom}`,
        start_time: startTime,
        end_time: endTime,
        full_transcript: `Transcription de la session de prospection de ${commercial.prenom} dans l'immeuble ${immeuble.adresse}. Durée: ${Math.floor(duration/60)} minutes.`,
        duration_seconds: duration,
        building_id: immeuble.id,
        building_name: immeuble.adresse,
        last_door_label: `${Math.floor(Math.random() * 5) + 1}${String.fromCharCode(65 + Math.floor(Math.random() * 4))}`,
      });
    }
  }
  
  await prisma.transcriptionSession.createMany({
    data: transcriptionSessions,
    skipDuplicates: true,
  });

  console.log(`Created ${transcriptionSessions.length} transcription sessions`);

  // --- Historique des assignations de zones ---
  const assignmentHistories = [];
  for (const zone of zones) {
    // Historique d'assignation pour les 6 derniers mois
    for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
      const assignmentDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
      
      assignmentHistories.push({
        zoneId: zone.id,
        assignedToType: zone.typeAssignation,
        assignedToId: zone.equipeId || zone.managerId || zone.commercialId || '',
        assignedByUserId: 'system',
        assignedByUserName: 'System Auto-Assignment',
        startDate: assignmentDate,
        endDate: monthOffset === 0 ? null : new Date(assignmentDate.getFullYear(), assignmentDate.getMonth() + 1, 0),
      });
    }
  }
  
  await prisma.zoneAssignmentHistory.createMany({
    data: assignmentHistories,
    skipDuplicates: true,
  });

  console.log(`Created ${assignmentHistories.length} zone assignment histories`);

  // --- Requêtes de prospection ---
  const prospectionRequests = [];
  for (let i = 0; i < 15; i++) {
    const requester = commerciaux[Math.floor(Math.random() * commerciaux.length)];
    const partner = commerciaux[Math.floor(Math.random() * commerciaux.length)];
    
    if (requester.id !== partner.id) {
      const immeuble = immeubles[Math.floor(Math.random() * immeubles.length)];
      const statuses = ['PENDING', 'ACCEPTED', 'REFUSED'];
      
      prospectionRequests.push({
        immeubleId: immeuble.id,
        requesterId: requester.id,
        partnerId: partner.id,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        createdAt: new Date(today.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Derniers 30 jours
      });
    }
  }
  
  await prisma.prospectionRequest.createMany({
    data: prospectionRequests,
    skipDuplicates: true,
  });

  console.log(`Created ${prospectionRequests.length} prospection requests`);

  console.log(`✅ Comprehensive seeding completed successfully!`);
  console.log(`📊 Data summary:`);
  console.log(`   - 3 Managers`);
  console.log(`   - 6 Équipes`);
  console.log(`   - 12 Commerciaux`);
  console.log(`   - 8 Zones`);
  console.log(`   - 24 Immeubles with portes`);
  console.log(`   - ${historicalEntries.length} Historical entries`);
  console.log(`   - ${transcriptionSessions.length} Transcription sessions`);
  console.log(`   - ${assignmentHistories.length} Zone assignment histories`);
  console.log(`   - ${prospectionRequests.length} Prospection requests`);
  console.log(`   - Global goals configured`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });