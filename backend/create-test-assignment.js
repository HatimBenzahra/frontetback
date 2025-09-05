const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestAssignment() {
  try {
    const zones = await prisma.zone.findMany({ take: 1 });
    const commerciaux = await prisma.commercial.findMany({ take: 1 });
    
    if (zones.length === 0 || commerciaux.length === 0) {
      console.log('❌ Pas de données disponibles');
      return;
    }
    
    const startDate = new Date(Date.now() + 30 * 1000); // +30 secondes
    const endDate = new Date(Date.now() + 5 * 60 * 1000); // +5 minutes
    
    const assignment = await prisma.zoneAssignmentHistory.create({
      data: {
        zoneId: zones[0].id,
        assignedToType: 'COMMERCIAL',
        assignedToId: commerciaux[0].id,
        assignedByUserId: 'cron-test',
        assignedByUserName: 'Test Cron',
        startDate: startDate,
        endDate: endDate,
      }
    });
    
    console.log('✅ Assignation créée pour dans 30 secondes:', assignment.id);
    console.log('📅 Date de début:', startDate.toISOString());
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestAssignment();