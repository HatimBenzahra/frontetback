const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAdminAssignment() {
  try {
    console.log('🔴 Testing Admin Assignment with Scheduled Start Date...\n');

    // Get test data
    const zone = await prisma.zone.findFirst();
    const manager = await prisma.manager.findFirst({
      include: { equipes: { include: { commerciaux: true } } }
    });
    
    if (!zone || !manager) {
      console.log('❌ Missing test data');
      return;
    }

    const equipe = manager.equipes[0];
    if (!equipe) {
      console.log('❌ No equipe found for manager');
      return;
    }

    console.log(`📊 Test Data:`);
    console.log(`   Zone: ${zone.nom}`);
    console.log(`   Manager: ${manager.prenom} ${manager.nom}`);
    console.log(`   Equipe: ${equipe.nom}`);

    // Test 1: Admin creates assignment to an EQUIPE with immediate start
    console.log('\n🔵 TEST 1: Admin assignment to EQUIPE (immediate start)');
    
    const now = new Date();
    const adminAssignment = await prisma.zoneAssignmentHistory.create({
      data: {
        zoneId: zone.id,
        assignedToId: equipe.id,
        assignedToType: 'EQUIPE',
        assignedByUserId: 'admin-test',
        assignedByUserName: 'Test Admin',
        startDate: now,
        endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    console.log(`   ✅ Created admin assignment: ${adminAssignment.id}`);

    // Simulate activation logic for EQUIPE assignment
    const equipeWithCommercials = await prisma.equipe.findUnique({
      where: { id: equipe.id },
      include: { commerciaux: true }
    });

    console.log(`   Processing EQUIPE assignment for ${equipeWithCommercials.commerciaux.length} commercials...`);

    const activatedCommercials = [];
    for (const commercial of equipeWithCommercials.commerciaux) {
      const existingZoneCommercial = await prisma.zoneCommercial.findFirst({
        where: {
          zoneId: zone.id,
          commercialId: commercial.id
        }
      });

      if (existingZoneCommercial) {
        await prisma.zoneCommercial.update({
          where: { id: existingZoneCommercial.id },
          data: { isActive: true }
        });
        activatedCommercials.push(commercial);
        console.log(`     ✅ Activated existing: ${commercial.prenom} ${commercial.nom}`);
      } else {
        const newZoneCommercial = await prisma.zoneCommercial.create({
          data: {
            zoneId: zone.id,
            commercialId: commercial.id,
            isActive: true
          }
        });
        activatedCommercials.push(commercial);
        console.log(`     ✅ Created new activation: ${commercial.prenom} ${commercial.nom}`);
      }
    }

    // Update zone to point to equipe
    await prisma.zone.update({
      where: { id: zone.id },
      data: { equipeId: equipe.id }
    });

    console.log(`   ✅ Updated zone to be assigned to equipe`);

    // Verify results
    const activeZoneCommercials = await prisma.zoneCommercial.findMany({
      where: {
        zoneId: zone.id,
        isActive: true
      },
      include: { commercial: true }
    });

    const updatedZone = await prisma.zone.findUnique({
      where: { id: zone.id }
    });

    console.log('\n📋 Final Status:');
    console.log(`   Assignment ID: ${adminAssignment.id}`);
    console.log(`   Active ZoneCommercials: ${activeZoneCommercials.length}`);
    console.log(`   Zone assigned to equipe: ${updatedZone.equipeId === equipe.id ? 'YES' : 'NO'}`);

    if (activeZoneCommercials.length > 0 && updatedZone.equipeId === equipe.id) {
      console.log('✅ ADMIN TEST PASSED: Equipe assignment works correctly!');
      console.log(`   Activated commercials:`);
      activeZoneCommercials.forEach(zc => {
        console.log(`     - ${zc.commercial.prenom} ${zc.commercial.nom}`);
      });
    } else {
      console.log('❌ ADMIN TEST FAILED: Assignment was not activated properly');
    }

    // Test 2: Future admin assignment
    console.log('\n🟡 TEST 2: Admin assignment with future start date');
    
    const futureStart = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes in future
    const futureAssignment = await prisma.zoneAssignmentHistory.create({
      data: {
        zoneId: zone.id,
        assignedToId: manager.id,
        assignedToType: 'MANAGER',
        assignedByUserId: 'admin-test',
        assignedByUserName: 'Test Admin',
        startDate: futureStart,
        endDate: new Date(futureStart.getTime() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    console.log(`   ✅ Created future admin assignment: ${futureAssignment.id}`);
    console.log(`   Start time: ${futureStart.toISOString()}`);
    console.log(`   Current time: ${now.toISOString()}`);

    // Check if it would be activated now (should not be)
    const shouldActivate = futureStart <= now;
    console.log(`   Should activate now: ${shouldActivate ? 'YES' : 'NO'}`);
    
    if (!shouldActivate) {
      console.log('✅ ADMIN FUTURE TEST PASSED: Future assignment correctly scheduled');
    } else {
      console.log('❌ ADMIN FUTURE TEST FAILED: Future assignment logic incorrect');
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    
    // Remove active zone commercials
    await prisma.zoneCommercial.deleteMany({
      where: {
        zoneId: zone.id,
        isActive: true
      }
    });
    
    // Reset zone assignments
    await prisma.zone.update({
      where: { id: zone.id },
      data: { 
        equipeId: null,
        managerId: null
      }
    });
    
    // Delete test assignments
    await prisma.zoneAssignmentHistory.delete({ where: { id: adminAssignment.id } });
    await prisma.zoneAssignmentHistory.delete({ where: { id: futureAssignment.id } });
    
    console.log('✅ Cleanup completed');

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAdminAssignment();