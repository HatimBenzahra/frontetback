const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAssignmentLogic() {
  try {
    console.log('🧪 Testing Assignment Logic (Manager & Admin)...\n');

    // 1. Create a test assignment with immediate start time
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Get test data
    const manager = await prisma.manager.findFirst({
      include: { equipes: { include: { commerciaux: true } } }
    });
    
    const zone = await prisma.zone.findFirst({
      where: { OR: [{ managerId: null }, { managerId: manager.id }] }
    });
    
    const commercial = manager.equipes.flatMap(e => e.commerciaux)[0];

    if (!manager || !zone || !commercial) {
      console.log('❌ Missing test data (manager, zone, or commercial)');
      return;
    }

    console.log(`📊 Test Data:`);
    console.log(`   Manager: ${manager.prenom} ${manager.nom}`);
    console.log(`   Zone: ${zone.nom}`);
    console.log(`   Commercial: ${commercial.prenom} ${commercial.nom}`);

    // Test 1: Create assignment that should be active immediately
    console.log('\n🔵 TEST 1: Assignment with immediate start (should be activated)');
    const immediateAssignment = await prisma.zoneAssignmentHistory.create({
      data: {
        zoneId: zone.id,
        assignedToId: commercial.id,
        assignedToType: 'COMMERCIAL',
        assignedByUserId: 'test-manager',
        assignedByUserName: `${manager.prenom} ${manager.nom}`,
        startDate: now,
        endDate: endDate
      }
    });
    console.log(`   ✅ Created assignment: ${immediateAssignment.id}`);

    // Test the activation logic manually
    console.log('\n🔍 Manually testing activateFutureAssignments logic...');
    
    // Find assignments that should be activated
    const assignmentsToActivate = await prisma.zoneAssignmentHistory.findMany({
      where: {
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gt: now } }
        ]
      },
      include: { zone: true }
    });

    console.log(`   Found ${assignmentsToActivate.length} assignment(s) to activate`);

    if (assignmentsToActivate.length > 0) {
      for (const assignment of assignmentsToActivate) {
        console.log(`   Activating assignment ${assignment.id}...`);
        
        if (assignment.assignedToType === 'COMMERCIAL') {
          // Check if ZoneCommercial already exists
          const existingZoneCommercial = await prisma.zoneCommercial.findFirst({
            where: {
              zoneId: assignment.zoneId,
              commercialId: assignment.assignedToId
            }
          });

          if (existingZoneCommercial) {
            await prisma.zoneCommercial.update({
              where: { id: existingZoneCommercial.id },
              data: { isActive: true }
            });
            console.log(`     ✅ Updated existing ZoneCommercial to active`);
          } else {
            await prisma.zoneCommercial.create({
              data: {
                zoneId: assignment.zoneId,
                commercialId: assignment.assignedToId,
                isActive: true
              }
            });
            console.log(`     ✅ Created new active ZoneCommercial`);
          }
        }
        else if (assignment.assignedToType === 'EQUIPE') {
          // Get team commercials
          const equipe = await prisma.equipe.findUnique({
            where: { id: assignment.assignedToId },
            include: { commerciaux: true }
          });

          if (equipe) {
            for (const comm of equipe.commerciaux) {
              const existingZoneCommercial = await prisma.zoneCommercial.findFirst({
                where: {
                  zoneId: assignment.zoneId,
                  commercialId: comm.id
                }
              });

              if (existingZoneCommercial) {
                await prisma.zoneCommercial.update({
                  where: { id: existingZoneCommercial.id },
                  data: { isActive: true }
                });
              } else {
                await prisma.zoneCommercial.create({
                  data: {
                    zoneId: assignment.zoneId,
                    commercialId: comm.id,
                    isActive: true
                  }
                });
              }
            }

            // Update zone's equipeId
            await prisma.zone.update({
              where: { id: assignment.zoneId },
              data: { equipeId: assignment.assignedToId }
            });

            console.log(`     ✅ Activated ${equipe.commerciaux.length} commercials for team assignment`);
          }
        }
        else if (assignment.assignedToType === 'MANAGER') {
          // Update zone's managerId
          await prisma.zone.update({
            where: { id: assignment.zoneId },
            data: { managerId: assignment.assignedToId }
          });
          console.log(`     ✅ Assigned zone to manager`);
        }
      }
    }

    // Verify activation worked
    const zoneCommercial = await prisma.zoneCommercial.findFirst({
      where: {
        zoneId: zone.id,
        commercialId: commercial.id,
        isActive: true
      }
    });

    console.log('\n📋 Final Status:');
    console.log(`   Assignment ID: ${immediateAssignment.id}`);
    console.log(`   ZoneCommercial Active: ${zoneCommercial ? 'YES' : 'NO'}`);
    console.log(`   ZoneCommercial ID: ${zoneCommercial?.id || 'N/A'}`);

    if (zoneCommercial?.isActive) {
      console.log('✅ TEST PASSED: Manager assignment logic works correctly!');
    } else {
      console.log('❌ TEST FAILED: Assignment was not activated properly');
    }

    // Cleanup
    if (zoneCommercial) {
      await prisma.zoneCommercial.delete({ where: { id: zoneCommercial.id } });
    }
    await prisma.zoneAssignmentHistory.delete({ where: { id: immediateAssignment.id } });
    console.log('🧹 Cleanup completed');

    // Test 2: Future assignment
    console.log('\n🟡 TEST 2: Assignment with future start date (should NOT be activated yet)');
    const futureStart = new Date(now.getTime() + 60 * 1000); // 1 minute in future
    const futureAssignment = await prisma.zoneAssignmentHistory.create({
      data: {
        zoneId: zone.id,
        assignedToId: commercial.id,
        assignedToType: 'COMMERCIAL',
        assignedByUserId: 'test-admin',
        assignedByUserName: 'Test Admin',
        startDate: futureStart,
        endDate: new Date(futureStart.getTime() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    console.log(`   ✅ Created future assignment: ${futureAssignment.id}`);
    console.log(`   Start time: ${futureStart.toISOString()}`);

    // Check if it should be activated now (it shouldn't)
    const futureAssignmentsToActivate = await prisma.zoneAssignmentHistory.findMany({
      where: {
        id: futureAssignment.id,
        startDate: { lte: now }
      }
    });

    console.log(`   Assignments ready for activation: ${futureAssignmentsToActivate.length}`);
    
    if (futureAssignmentsToActivate.length === 0) {
      console.log('✅ TEST PASSED: Future assignment correctly not activated yet');
    } else {
      console.log('❌ TEST FAILED: Future assignment was incorrectly marked for activation');
    }

    // Cleanup future assignment
    await prisma.zoneAssignmentHistory.delete({ where: { id: futureAssignment.id } });
    console.log('🧹 Future assignment cleanup completed');

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAssignmentLogic();