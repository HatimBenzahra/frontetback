import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting cleanup of seeded data...');

  // Seed markers based on prisma/seed.ts
  const managerEmails = [
    'jean.dupont@example.com',
    'marie.curie@example.com',
  ];

  const equipeNames = [
    'Équipe Alpha',
    'Équipe Beta',
    'Équipe Gamma',
  ];

  const commercialEmails = [
    'alice.martin@example.com',
    'bob.durand@example.com',
    'charlie.leblanc@example.com',
    'diana.rousseau@example.com',
  ];

  const zoneNames = [
    'Zone Centre-Ville',
    'Zone Périphérie Nord',
    'Zone Sud-Est',
  ];

  const immeubleAdresses = [
    '123 Rue de la République',
    '456 Avenue des Frères Lumière',
    '789 Boulevard de la Croix-Rousse',
    '101 Rue Garibaldi',
  ];

  // Resolve ids
  const managers = await prisma.manager.findMany({ where: { email: { in: managerEmails } }, select: { id: true } });
  const managerIds = managers.map(m => m.id);

  const equipes = await prisma.equipe.findMany({ where: { nom: { in: equipeNames } }, select: { id: true } });
  const equipeIds = equipes.map(e => e.id);

  const commercials = await prisma.commercial.findMany({ where: { email: { in: commercialEmails } }, select: { id: true } });
  const commercialIds = commercials.map(c => c.id);

  const zones = await prisma.zone.findMany({ where: { nom: { in: zoneNames } }, select: { id: true } });
  const zoneIds = zones.map(z => z.id);

  const immeubles = await prisma.immeuble.findMany({ where: { adresse: { in: immeubleAdresses } }, select: { id: true } });
  const immeubleIds = immeubles.map(i => i.id);

  console.log('Deleting related child data...');

  // Prospection requests (if any)
  await prisma.prospectionRequest.deleteMany({
    where: {
      OR: [
        { requesterId: { in: commercialIds } },
        { partnerId: { in: commercialIds } },
      ],
    },
  });

  // Portes linked to seeded immeubles
  await prisma.porte.deleteMany({ where: { immeubleId: { in: immeubleIds } } });

  // Historique prospection linked to seeded commercials or immeubles
  await prisma.historiqueProspection.deleteMany({
    where: {
      OR: [
        { commercialId: { in: commercialIds } },
        { immeubleId: { in: immeubleIds } },
      ],
    },
  });

  // Zone assignment histories
  await prisma.zoneAssignmentHistory.deleteMany({ where: { zoneId: { in: zoneIds } } });

  console.log('Deleting root records...');

  // Immeubles
  await prisma.immeuble.deleteMany({ where: { id: { in: immeubleIds } } });

  // Zones
  await prisma.zone.deleteMany({ where: { id: { in: zoneIds } } });

  // Commerciaux
  await prisma.commercial.deleteMany({ where: { id: { in: commercialIds } } });

  // Équipes
  await prisma.equipe.deleteMany({ where: { id: { in: equipeIds } } });

  // Managers
  await prisma.manager.deleteMany({ where: { id: { in: managerIds } } });

  console.log('Cleanup completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


