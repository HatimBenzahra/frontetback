const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testManagerAssignment() {
  try {
    console.log('🔍 Testing Manager Assignment with Scheduled Start Date...\n');

    // 1. Get a manager
    const manager = await prisma.manager.findFirst({
      include: {
        equipes: {
          include: { commerciaux: true }
        }
      }
    });

    if (!manager) {
      console.log('❌ No manager found in database');
      return;
    }

    console.log(`📊 Found manager: ${manager.prenom} ${manager.nom} (ID: ${manager.id})`);

    // 2. Get a zone that can be assigned to this manager
    const zone = await prisma.zone.findFirst({
      where: {
        OR: [
          { managerId: null }, // Unassigned zone
          { managerId: manager.id } // Zone already assigned to this manager
        ]
      }
    });

    if (!zone) {
      console.log('❌ No assignable zone found for this manager');
      return;
    }

    console.log(`🌍 Found zone: ${zone.nom} (ID: ${zone.id})`);

    // 3. Get a commercial from manager's teams
    const commercial = manager.equipes.flatMap(e => e.commerciaux)[0];
    
    if (!commercial) {
      console.log('❌ No commercial found in manager\'s teams');
      return;
    }

    console.log(`👤 Found commercial: ${commercial.prenom} ${commercial.nom} (ID: ${commercial.id})`);

    // 4. Create a scheduled assignment via manager service logic
    const startDate = new Date();
    startDate.setSeconds(startDate.getSeconds() + 30); // Start in 30 seconds

    console.log(`⏰ Creating assignment to start at: ${startDate.toISOString()}`);

    // Simulate the manager assignment creation (this would normally go through the controller)
    const assignment = await prisma.zoneAssignmentHistory.create({
      data: {
        zoneId: zone.id,
        assignedToId: commercial.id,
        assignedToType: 'COMMERCIAL',
        assignedByUserId: 'test-manager',
        assignedByUserName: `${manager.prenom} ${manager.nom}`,
        startDate: startDate,
        endDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    console.log(`✅ Created manager assignment: ${assignment.id}`);
    console.log(`📝 Assignment details:`);
    console.log(`   - Zone: ${zone.nom}`);
    console.log(`   - Commercial: ${commercial.prenom} ${commercial.nom}`);
    console.log(`   - Start: ${startDate.toISOString()}`);
    console.log(`   - Assignment ID: ${assignment.id}`);

    // 5. Check initial state
    const initialZoneCommercial = await prisma.zoneCommercial.findFirst({
      where: {
        zoneId: zone.id,
        commercialId: commercial.id
      }
    });

    console.log(`\n📊 Initial ZoneCommercial state: ${initialZoneCommercial ? `Active: ${initialZoneCommercial.isActive}` : 'Not found'}`);

    // 6. Wait for activation
    console.log('\n⏳ Waiting 35 seconds for cron job activation...');
    await new Promise(resolve => setTimeout(resolve, 35000));

    // 7. Check if assignment was activated
    const updatedZoneCommercial = await prisma.zoneCommercial.findFirst({
      where: {
        zoneId: zone.id,
        commercialId: commercial.id
      }
    });

    console.log(`\n🔍 Post-activation check:`);
    console.log(`   - ZoneCommercial Active: ${updatedZoneCommercial ? updatedZoneCommercial.isActive : 'Not found'}`);

    if (updatedZoneCommercial?.isActive) {
      console.log('✅ MANAGER TEST PASSED: Assignment was automatically activated!');
    } else {
      console.log('❌ MANAGER TEST FAILED: Assignment was not automatically activated');
    }

    // Cleanup
    await prisma.zoneCommercial.deleteMany({
      where: {
        zoneId: zone.id,
        commercialId: commercial.id
      }
    });

    await prisma.zoneAssignmentHistory.delete({
      where: { id: assignment.id }
    });

    console.log('🧹 Test cleanup completed\n');

  } catch (error) {
    console.error('❌ Error during manager assignment test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testManagerAssignment();