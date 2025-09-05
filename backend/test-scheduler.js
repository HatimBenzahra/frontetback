const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testScheduler() {
  console.log('🧪 Test du système de scheduling des assignations...\n');

  try {
    // 1. Créer une assignation de test avec une date de début dans le passé
    const now = new Date();
    const pastDate = new Date(now.getTime() - 60000); // 1 minute dans le passé
    const futureDate = new Date(now.getTime() + 3600000); // 1 heure dans le futur

    console.log('📅 Dates de test:');
    console.log(`   Maintenant: ${now.toISOString()}`);
    console.log(`   Date de début (passé): ${pastDate.toISOString()}`);
    console.log(`   Date de fin (futur): ${futureDate.toISOString()}\n`);

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
        startDate: pastDate,
        endDate: futureDate,
        assignedByUserName: 'Test Scheduler'
      }
    });

    console.log(`✅ Assignation de test créée (ID: ${testAssignment.id})`);

    // 4. Vérifier s'il existe déjà un ZoneCommercial pour cette combinaison
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
      console.log(`✅ ZoneCommercial existant mis à jour (ID: ${zoneCommercial.id})`);
    } else {
      // Créer un nouveau ZoneCommercial inactif
      zoneCommercial = await prisma.zoneCommercial.create({
        data: {
          zoneId: zone.id,
          commercialId: commercial.id,
          isActive: false,
          assignedBy: 'Test Scheduler'
        }
      });
      console.log(`✅ ZoneCommercial inactif créé (ID: ${zoneCommercial.id})`);
    }

    // 5. Vérifier l'état initial
    const initialState = await prisma.zoneCommercial.findUnique({
      where: { id: zoneCommercial.id }
    });

    console.log(`\n📊 État initial: isActive = ${initialState.isActive}`);

    // 6. Simuler l'activation (ce que ferait le cron job)
    console.log('\n🔄 Simulation de l\'activation automatique...');
    
    const assignmentsToActivate = await prisma.zoneAssignmentHistory.findMany({
      where: {
        startDate: {
          lte: now
        },
        endDate: {
          gt: now
        }
      }
    });

    console.log(`📋 ${assignmentsToActivate.length} assignation(s) trouvée(s) à activer`);

    let totalActivated = 0;

    for (const assignment of assignmentsToActivate) {
      // Récupérer les commerciaux à activer
      let commerciauxToActivate = [];
      
      switch (assignment.assignedToType) {
        case 'COMMERCIAL':
          commerciauxToActivate = [assignment.assignedToId];
          break;
        case 'EQUIPE':
          const equipe = await prisma.equipe.findUnique({
            where: { id: assignment.assignedToId },
            include: { commerciaux: true }
          });
          commerciauxToActivate = equipe?.commerciaux.map(c => c.id) || [];
          break;
        case 'MANAGER':
          const manager = await prisma.manager.findUnique({
            where: { id: assignment.assignedToId },
            include: {
              equipes: {
                include: { commerciaux: true }
              }
            }
          });
          commerciauxToActivate = manager?.equipes.flatMap(equipe =>
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
            `✅ Assignation activée: Zone ${assignment.zoneId} → ${assignment.assignedToType} ${assignment.assignedToId} (${updateResult.count} commerciaux)`
          );
        }
      }
    }

    // 7. Vérifier l'état final
    const finalState = await prisma.zoneCommercial.findUnique({
      where: { id: zoneCommercial.id }
    });

    console.log(`\n📊 État final: isActive = ${finalState.isActive}`);

    if (finalState.isActive) {
      console.log('🎉 Test réussi ! L\'assignation a été activée automatiquement.');
    } else {
      console.log('❌ Test échoué ! L\'assignation n\'a pas été activée.');
    }

    // 8. Nettoyage
    console.log('\n🧹 Nettoyage des données de test...');
    await prisma.zoneCommercial.delete({ where: { id: zoneCommercial.id } });
    await prisma.zoneAssignmentHistory.delete({ where: { id: testAssignment.id } });
    console.log('✅ Données de test supprimées');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testScheduler();
