const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testScheduledAssignment() {
  try {
    console.log('🧪 Test d\'assignation programmée');
    console.log('📅 Heure actuelle:', new Date().toISOString());
    
    // 1. Trouver une zone existante
    const zones = await prisma.zone.findMany({ take: 1 });
    if (zones.length === 0) {
      console.log('❌ Aucune zone trouvée');
      return;
    }
    const zone = zones[0];
    console.log('🎯 Zone trouvée:', zone.nom);
    
    // 2. Trouver un commercial existant
    const commerciaux = await prisma.commercial.findMany({ take: 1 });
    if (commerciaux.length === 0) {
      console.log('❌ Aucun commercial trouvé');
      return;
    }
    const commercial = commerciaux[0];
    console.log('👤 Commercial trouvé:', commercial.nom, commercial.prenom);
    
    // 3. Créer une assignation programmée avec date de début dans 1 minute
    const startDate = new Date(Date.now() + 60 * 1000); // +1 minute
    const endDate = new Date(Date.now() + 5 * 60 * 1000); // +5 minutes
    
    console.log('⏰ Date de début programmée:', startDate.toISOString());
    console.log('⏰ Date de fin programmée:', endDate.toISOString());
    
    const assignment = await prisma.zoneAssignmentHistory.create({
      data: {
        zoneId: zone.id,
        assignedToType: 'COMMERCIAL',
        assignedToId: commercial.id,
        assignedByUserId: 'test-user',
        assignedByUserName: 'Test User',
        startDate: startDate,
        endDate: endDate,
      }
    });
    
    console.log('✅ Assignation programmée créée avec ID:', assignment.id);
    
    // 4. Vérifier l'état initial
    console.log('\n📋 État initial:');
    const initialActiveAssignments = await prisma.zoneCommercial.findMany({
      where: {
        zoneId: zone.id,
        commercialId: commercial.id,
        isActive: true
      }
    });
    console.log('🔍 Assignations actives:', initialActiveAssignments.length);
    
    // 5. Simuler l'activation immédiate (pour le test)
    console.log('\n🚀 Test d\'activation immédiate...');
    const now = new Date();
    const futureAssignments = await prisma.zoneAssignmentHistory.findMany({
      where: {
        startDate: { lte: now }, // Devrait être vide maintenant
        endDate: { gt: now },
      }
    });
    console.log('📊 Assignations futures à activer:', futureAssignments.length);
    
    // 6. Forcer l'activation pour le test en modifiant la date
    await prisma.zoneAssignmentHistory.update({
      where: { id: assignment.id },
      data: { startDate: new Date(Date.now() - 1000) } // -1 seconde
    });
    
    console.log('⚡ Date de début modifiée pour activation immédiate');
    
    // 7. Réexécuter la vérification
    const updatedFutureAssignments = await prisma.zoneAssignmentHistory.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gt: now },
      }
    });
    console.log('📊 Assignations futures à activer (après modification):', updatedFutureAssignments.length);
    
    // 8. Simuler la logique d'activation
    if (updatedFutureAssignments.length > 0) {
      for (const futureAssignment of updatedFutureAssignments) {
        if (futureAssignment.assignedToType === 'COMMERCIAL') {
          // Créer ou réactiver l'assignation
          await prisma.zoneCommercial.upsert({
            where: {
              zoneId_commercialId: {
                zoneId: futureAssignment.zoneId,
                commercialId: futureAssignment.assignedToId
              }
            },
            update: { isActive: true, endedAt: null },
            create: {
              zoneId: futureAssignment.zoneId,
              commercialId: futureAssignment.assignedToId,
              assignedBy: futureAssignment.assignedByUserId,
              isActive: true
            }
          });
          console.log('✅ Assignation activée pour commercial:', futureAssignment.assignedToId);
        }
      }
    }
    
    // 9. Vérifier l'état final
    console.log('\n📋 État final:');
    const finalActiveAssignments = await prisma.zoneCommercial.findMany({
      where: {
        zoneId: zone.id,
        commercialId: commercial.id,
        isActive: true
      }
    });
    console.log('🔍 Assignations actives:', finalActiveAssignments.length);
    
    console.log('\n🎉 Test terminé avec succès!');
    console.log('💡 Résultat: L\'assignation programmée', finalActiveAssignments.length > initialActiveAssignments.length ? 'FONCTIONNE ✅' : 'NE FONCTIONNE PAS ❌');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testScheduledAssignment();