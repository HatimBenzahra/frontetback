const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLiveCron() {
  console.log('🚀 Test du système de cron job en direct...\n');

  try {
    // 1. Créer une assignation de test qui devrait être activée dans 10 secondes
    const now = new Date();
    const startDate = new Date(now.getTime() + 10000); // 10 secondes dans le futur
    const endDate = new Date(now.getTime() + 3600000); // 1 heure dans le futur

    console.log('📅 Dates de test:');
    console.log(`   Maintenant: ${now.toISOString()}`);
    console.log(`   Date de début (dans 10s): ${startDate.toISOString()}`);
    console.log(`   Date de fin: ${endDate.toISOString()}\n`);

    // 2. Trouver une zone et un commercial existants
    const zone = await prisma.zone.findFirst();
    const commercial = await prisma.commercial.findFirst();

    if (!zone || !commercial) {
      console.log('❌ Aucune zone ou commercial trouvé dans la base de données');
      return;
    }

    console.log(`🏢 Zone de test: ${zone.nom} (ID: ${zone.id})`);
    console.log(`👤 Commercial de test: ${commercial.prenom} ${commercial.nom} (ID: ${commercial.id})\n`);

    // 3. Créer une assignation de test
    const testAssignment = await prisma.zoneAssignmentHistory.create({
      data: {
        zoneId: zone.id,
        assignedToType: 'COMMERCIAL',
        assignedToId: commercial.id,
        startDate: startDate,
        endDate: endDate,
        assignedByUserName: 'Test Live Cron'
      }
    });

    console.log(`✅ Assignation de test créée (ID: ${testAssignment.id})`);

    // 4. S'assurer qu'il y a un ZoneCommercial inactif
    let zoneCommercial = await prisma.zoneCommercial.findFirst({
      where: {
        zoneId: zone.id,
        commercialId: commercial.id
      }
    });

    if (zoneCommercial) {
      zoneCommercial = await prisma.zoneCommercial.update({
        where: { id: zoneCommercial.id },
        data: { isActive: false }
      });
      console.log(`✅ ZoneCommercial mis à jour (ID: ${zoneCommercial.id}) - isActive: false`);
    } else {
      zoneCommercial = await prisma.zoneCommercial.create({
        data: {
          zoneId: zone.id,
          commercialId: commercial.id,
          isActive: false,
          assignedBy: 'Test Live Cron'
        }
      });
      console.log(`✅ ZoneCommercial créé (ID: ${zoneCommercial.id}) - isActive: false`);
    }

    console.log('\n⏰ Attente de 15 secondes pour que le cron job s\'exécute...');
    console.log('   (Le cron job s\'exécute toutes les minutes, mais nous attendons un peu plus)');
    
    // Attendre 15 secondes
    await new Promise(resolve => setTimeout(resolve, 15000));

    // 5. Vérifier l'état après l'attente
    const finalState = await prisma.zoneCommercial.findUnique({
      where: { id: zoneCommercial.id }
    });

    console.log(`\n📊 État après attente: isActive = ${finalState.isActive}`);

    if (finalState.isActive) {
      console.log('🎉 Succès ! Le cron job a activé l\'assignation automatiquement.');
    } else {
      console.log('⏳ L\'assignation n\'a pas encore été activée. Cela peut être normal si:');
      console.log('   - Le serveur NestJS n\'est pas démarré');
      console.log('   - Le cron job n\'a pas encore eu le temps de s\'exécuter');
      console.log('   - Il y a un problème avec la configuration du cron job');
    }

    // 6. Nettoyage
    console.log('\n🧹 Nettoyage des données de test...');
    await prisma.zoneCommercial.delete({ where: { id: zoneCommercial.id } });
    await prisma.zoneAssignmentHistory.delete({ where: { id: testAssignment.id } });
    console.log('✅ Données de test supprimées');

    console.log('\n💡 Pour tester complètement le système:');
    console.log('   1. Démarrez le serveur NestJS: npm run start:dev');
    console.log('   2. Relancez ce script');
    console.log('   3. Observez les logs du serveur pour voir les messages du cron job');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testLiveCron();