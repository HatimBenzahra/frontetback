const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDates() {
  try {
    console.log('🔍 Vérification des dates dans HistoriqueProspection...\n');

    // Get all prospection history data
    const allData = await prisma.historiqueProspection.findMany({
      orderBy: {
        dateProspection: 'desc'
      },
      include: {
        commercial: true
      }
    });

    console.log(`📊 Total d'entrées dans HistoriqueProspection: ${allData.length}\n`);

    // Group by periods
    const now = new Date();
    
    // Calculate period boundaries
    const getWeekStart = () => {
      const currentDay = now.getDay();
      const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
      const weekStart = new Date(new Date().setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      return weekStart;
    };

    const getMonthStart = () => {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      return monthStart;
    };

    const getYearStart = () => {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      yearStart.setHours(0, 0, 0, 0);
      return yearStart;
    };

    const weekStart = getWeekStart();
    const monthStart = getMonthStart();
    const yearStart = getYearStart();

    console.log('📅 Limites des périodes:');
    console.log(`Semaine depuis: ${weekStart.toLocaleDateString()}`);
    console.log(`Mois depuis: ${monthStart.toLocaleDateString()}`);
    console.log(`Année depuis: ${yearStart.toLocaleDateString()}\n`);

    // Filter data by periods
    const weeklyData = allData.filter(d => new Date(d.dateProspection) >= weekStart);
    const monthlyData = allData.filter(d => new Date(d.dateProspection) >= monthStart);
    const yearlyData = allData.filter(d => new Date(d.dateProspection) >= yearStart);

    console.log('🎯 Données par période:');
    console.log('─'.repeat(80));
    
    console.log('\n📅 DONNÉES WEEKLY (cette semaine):');
    weeklyData.forEach(d => {
      const isTestData = d.commentaire === 'TEST_DATA' ? '🧪' : '🔹';
      console.log(`${isTestData} ${new Date(d.dateProspection).toLocaleDateString()} - ${d.nbContratsSignes} contrats, ${d.nbRdvPris} RDV (${d.commercial?.prenom || 'N/A'})`);
    });
    console.log(`Total WEEKLY: ${weeklyData.reduce((sum, d) => sum + d.nbContratsSignes, 0)} contrats`);

    console.log('\n📅 DONNÉES MONTHLY (ce mois):');
    monthlyData.forEach(d => {
      const isTestData = d.commentaire === 'TEST_DATA' ? '🧪' : '🔹';
      console.log(`${isTestData} ${new Date(d.dateProspection).toLocaleDateString()} - ${d.nbContratsSignes} contrats, ${d.nbRdvPris} RDV (${d.commercial?.prenom || 'N/A'})`);
    });
    console.log(`Total MONTHLY: ${monthlyData.reduce((sum, d) => sum + d.nbContratsSignes, 0)} contrats`);

    console.log('\n📅 DONNÉES YEARLY (cette année):');
    yearlyData.forEach(d => {
      const isTestData = d.commentaire === 'TEST_DATA' ? '🧪' : '🔹';
      console.log(`${isTestData} ${new Date(d.dateProspection).toLocaleDateString()} - ${d.nbContratsSignes} contrats, ${d.nbRdvPris} RDV (${d.commercial?.prenom || 'N/A'})`);
    });
    console.log(`Total YEARLY: ${yearlyData.reduce((sum, d) => sum + d.nbContratsSignes, 0)} contrats`);

    console.log('\n🧪 Données de test uniquement:');
    const testData = allData.filter(d => d.commentaire === 'TEST_DATA');
    testData.forEach(d => {
      console.log(`📊 ${new Date(d.dateProspection).toLocaleDateString()} - ${d.nbContratsSignes} contrats, ${d.nbRdvPris} RDV`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDates();