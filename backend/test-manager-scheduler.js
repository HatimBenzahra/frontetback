const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testManagerScheduler() {
  console.log('🧪 Test du système de scheduling des assignations MANAGER...\n');

  try {
    // 1. Créer une assignation de test avec une date de début dans le passé
    const now = new Date();
    const pastDate = new Date(now.getTime() - 60000); // 1 minute dans le passé
    const futureDate = new Date(now.getTime() + 3600000); // 1 heure dans le futur

    console.log('📅 Dates de test:');
    console.log(`   Maintenant: ${now.toISOString()}`);
    console.log(`   Date de début (passé): ${pastDate.toISOString()}`);
    console.log(`   Date de fin (futur): ${futureDate.toISOString()}\n`);

    // 2. Trouver un manager et une zone existants
    const manager = await prisma.manager.findFirst({
      include: {
        equipes: {
          include: { commerciaux: true }
        }
      }
    });
    const zone = await prisma.zone.findFirst();

    if (!manager || !zone) {
      console.log('❌ Aucun manager ou zone trouvé dans la base de données');
      return;
    }

    console.log(`👨‍💼 Manager de test: ${manager.prenom} ${manager.nom} (ID: ${manager.id})`);
    console.log(`🏢 Zone de test: ${zone.nom} (ID: ${zone.id})`);
    console.log(`👥 Équipes du manager: ${manager.equipes.length}`);
    
    if (manager.equipes.length > 0) {
      const totalCommerciaux = manager.equipes.reduce((sum, equipe) => sum + equipe.commerciaux.length, 0);
      console.log(`👤 Total commerciaux dans les équipes: ${totalCommerciaux}\n`);
    }

    // 3. Créer une assignation de test pour le manager
    const testAssignment = await prisma.zoneAssignmentHistory.create({
      data: {
        zoneId: zone.id,
        assignedToType: 'MANAGER',
        assignedToId: manager.id,
        startDate: pastDate,
        endDate: futureDate,
        assignedByUserName: 'Test Manager Scheduler'
      }
    });

    console.log(`✅ Assignation MANAGER de test créée (ID: ${testAssignment.id})`);

    // 4. Créer des ZoneCommercial inactifs pour les commerciaux des équipes du manager
    let totalZoneCommercials = 0;
    const zoneCommercials = [];

    for (const equipe of manager.equipes) {
      for (const commercial of equipe.commerciaux) {
        // Vérifier s'il existe déjà un ZoneCommercial pour cette combinaison
        let zoneCommercial = await prisma.zoneCommercial.findFirst({
          where: {
            zoneId: zone.id,
            commercialId: commercial.id
          }
        });

        if (zoneCommercial) {
          // Mettre à jour l'existant pour le rendre inactif
          zoneCommercial = await prisma.zoneCommercial.update({
            where: { id: zoneCommercial.id },
            data: { isActive: false }
          });
        } else {
          // Créer un nouveau ZoneCommercial inactif
          zoneCommercial = await prisma.zoneCommercial.create({
            data: {
              zoneId: zone.id,
              commercialId: commercial.id,
              isActive: false,
              assignedBy: 'Test Manager Scheduler'
            }
          });
        }

        zoneCommercials.push(zoneCommercial);
        totalZoneCommercials++;
      }
    }

    console.log(`✅ ${totalZoneCommercials} ZoneCommercial(s) inactif(s) créé(s)/mis à jour`);

    // 5. Vérifier l'état initial
    const inactiveCount = await prisma.zoneCommercial.count({
      where: {
        zoneId: zone.id,
        isActive: false
      }
    });

    console.log(`\n📊 État initial: ${inactiveCount} ZoneCommercial(s) inactif(s)`);

    // 6. Simuler l'activation (ce que ferait le cron job)
    console.log('\n🔄 Simulation de l\'activation automatique des assignations MANAGER...');
    
    const assignmentsToActivate = await prisma.zoneAssignmentHistory.findMany({
      where: {
        startDate: {
          lte: now
        },
        endDate: {
          gt: now
        },
        assignedToType: {
          in: ['MANAGER', 'EQUIPE']
        }
      }
    });

    console.log(`📋 ${assignmentsToActivate.length} assignation(s) MANAGER/EQUIPE trouvée(s) à activer`);

    let totalActivated = 0;

    for (const assignment of assignmentsToActivate) {
      // Récupérer les commerciaux à activer
      let commerciauxToActivate = [];
      
      switch (assignment.assignedToType) {
        case 'EQUIPE':
          const equipe = await prisma.equipe.findUnique({
            where: { id: assignment.assignedToId },
            include: { commerciaux: true }
          });
          commerciauxToActivate = equipe?.commerciaux.map(c => c.id) || [];
          break;
        case 'MANAGER':
          const managerData = await prisma.manager.findUnique({
            where: { id: assignment.assignedToId },
            include: {
              equipes: {
                include: { commerciaux: true }
              }
            }
          });
          commerciauxToActivate = managerData?.equipes.flatMap(equipe =>
            equipe.commerciaux.map(c => c.id)
          ) || [];
          break;
      }

      if (commerciauxToActivate.length > 0) {
        // Vérifier s'il y a des ZoneCommercial inactifs à activer
        const inactiveZoneCommercials = await prisma.zoneCommercial.findMany({
          where: {
            zoneId: assignment.zoneId,
            commercialId: {
              in: commerciauxToActivate
            },
            isActive: false
          }
        });

        if (inactiveZoneCommercials.length > 0) {
          // Activer les ZoneCommercial correspondants
          const updateResult = await prisma.zoneCommercial.updateMany({
            where: {
              zoneId: assignment.zoneId,
              commercialId: {
                in: commerciauxToActivate
              },
              isActive: false
            },
            data: {
              isActive: true
            }
          });

          totalActivated += updateResult.count;

          console.log(
            `✅ Assignation MANAGER activée: Zone ${assignment.zoneId} → ${assignment.assignedToType} ${assignment.assignedToId} (${updateResult.count} commerciaux)`
          );
        }
      }
    }

    // 7. Vérifier l'état final
    const finalInactiveCount = await prisma.zoneCommercial.count({
      where: {
        zoneId: zone.id,
        isActive: false
      }
    });

    const finalActiveCount = await prisma.zoneCommercial.count({
      where: {
        zoneId: zone.id,
        isActive: true
      }
    });

    console.log(`\n📊 État final:`);
    console.log(`   ZoneCommercial(s) inactif(s): ${finalInactiveCount}`);
    console.log(`   ZoneCommercial(s) actif(s): ${finalActiveCount}`);

    if (totalActivated > 0) {
      console.log('🎉 Test réussi ! Les assignations MANAGER ont été activées automatiquement.');
    } else {
      console.log('❌ Test échoué ! Aucune assignation MANAGER n\'a été activée.');
    }

    // 8. Nettoyage
    console.log('\n🧹 Nettoyage des données de test...');
    await prisma.zoneAssignmentHistory.delete({ where: { id: testAssignment.id } });
    console.log('✅ Données de test supprimées');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testManagerScheduler();
