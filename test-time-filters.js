const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testTimeFilters() {
  try {
    console.log('🧪 TEST DES FILTRES DE TEMPS\n');

    // 1. Test du calcul des dates de début
    console.log('📅 1. CALCUL DES DATES DE DÉBUT');
    const now = new Date();
    
    // Fonction utilitaire pour calculer le début de semaine
    function getStartOfWeek(date) {
      const startOfWeek = new Date(date);
      const day = startOfWeek.getDay();
      const daysFromMonday = day === 0 ? 6 : day - 1;
      startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      return startOfWeek;
    }

    const startOfWeek = getStartOfWeek(now);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    console.log('Date actuelle:', now.toISOString());
    console.log('Début de semaine:', startOfWeek.toISOString());
    console.log('Début de mois:', startOfMonth.toISOString());
    console.log('Début d\'année:', startOfYear.toISOString());

    // 2. Vérifier les données existantes
    console.log('\n📊 2. DONNÉES EXISTANTES DANS LA BASE');
    const allHistories = await prisma.historiqueProspection.findMany({
      select: {
        id: true,
        dateProspection: true,
        nbContratsSignes: true,
        commercial: {
          select: {
            prenom: true,
            nom: true
          }
        }
      },
      orderBy: {
        dateProspection: 'desc'
      }
    });

    console.log(`Total d'historiques: ${allHistories.length}`);
    
    if (allHistories.length > 0) {
      console.log('\n5 derniers historiques:');
      allHistories.slice(0, 5).forEach((h, i) => {
        console.log(`${i + 1}. ${h.dateProspection.toISOString()} | ${h.nbContratsSignes} contrats | ${h.commercial?.prenom} ${h.commercial?.nom}`);
      });
    }

    // 3. Test des filtres avec requêtes directes
    console.log('\n🔍 3. TEST DES FILTRES AVEC REQUÊTES DIRECTES');

    // Test semaine
    const weeklyContrats = await prisma.historiqueProspection.aggregate({
      where: {
        dateProspection: {
          gte: startOfWeek
        }
      },
      _sum: {
        nbContratsSignes: true,
        nbRdvPris: true,
        nbPortesVisitees: true
      }
    });

    // Test mois
    const monthlyContrats = await prisma.historiqueProspection.aggregate({
      where: {
        dateProspection: {
          gte: startOfMonth
        }
      },
      _sum: {
        nbContratsSignes: true,
        nbRdvPris: true,
        nbPortesVisitees: true
      }
    });

    // Test année
    const yearlyContrats = await prisma.historiqueProspection.aggregate({
      where: {
        dateProspection: {
          gte: startOfYear
        }
      },
      _sum: {
        nbContratsSignes: true,
        nbRdvPris: true,
        nbPortesVisitees: true
      }
    });

    console.log('📈 RÉSULTATS DES FILTRES:');
    console.log(`Semaine (depuis ${startOfWeek.toISOString()}):`);
    console.log(`  - Contrats: ${weeklyContrats._sum.nbContratsSignes || 0}`);
    console.log(`  - RDV: ${weeklyContrats._sum.nbRdvPris || 0}`);
    console.log(`  - Portes visitées: ${weeklyContrats._sum.nbPortesVisitees || 0}`);

    console.log(`\nMois (depuis ${startOfMonth.toISOString()}):`);
    console.log(`  - Contrats: ${monthlyContrats._sum.nbContratsSignes || 0}`);
    console.log(`  - RDV: ${monthlyContrats._sum.nbRdvPris || 0}`);
    console.log(`  - Portes visitées: ${monthlyContrats._sum.nbPortesVisitees || 0}`);

    console.log(`\nAnnée (depuis ${startOfYear.toISOString()}):`);
    console.log(`  - Contrats: ${yearlyContrats._sum.nbContratsSignes || 0}`);
    console.log(`  - RDV: ${yearlyContrats._sum.nbRdvPris || 0}`);
    console.log(`  - Portes visitées: ${yearlyContrats._sum.nbPortesVisitees || 0}`);

    // 4. Test de l'API
    console.log('\n🌐 4. TEST DE L\'API BACKEND');
    
    const testAPI = async (period) => {
      try {
        const response = await fetch(`https://localhost:3000/statistics?period=${period}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          return data.totalContrats;
        } else {
          return `Erreur ${response.status}`;
        }
      } catch (error) {
        return `Erreur: ${error.message}`;
      }
    };

    console.log('Test API WEEKLY:', await testAPI('WEEKLY'));
    console.log('Test API MONTHLY:', await testAPI('MONTHLY'));
    console.log('Test API YEARLY:', await testAPI('YEARLY'));

    // 5. Vérification de cohérence
    console.log('\n✅ 5. VÉRIFICATION DE COHÉRENCE');
    
    const weeklyCount = weeklyContrats._sum.nbContratsSignes || 0;
    const monthlyCount = monthlyContrats._sum.nbContratsSignes || 0;
    const yearlyCount = yearlyContrats._sum.nbContratsSignes || 0;

    console.log('Vérifications:');
    console.log(`- Semaine ≤ Mois: ${weeklyCount <= monthlyCount ? '✅' : '❌'}`);
    console.log(`- Mois ≤ Année: ${monthlyCount <= yearlyCount ? '✅' : '❌'}`);
    console.log(`- Semaine ≤ Année: ${weeklyCount <= yearlyCount ? '✅' : '❌'}`);

    // 6. Test avec des dates spécifiques
    console.log('\n📅 6. TEST AVEC DES DATES SPÉCIFIQUES');
    
    // Test avec une date de la semaine dernière
    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);
    const lastWeekStart = getStartOfWeek(lastWeek);
    
    const lastWeekContrats = await prisma.historiqueProspection.aggregate({
      where: {
        dateProspection: {
          gte: lastWeekStart,
          lt: startOfWeek
        }
      },
      _sum: {
        nbContratsSignes: true
      }
    });

    console.log(`Semaine dernière (${lastWeekStart.toISOString()} - ${startOfWeek.toISOString()}): ${lastWeekContrats._sum.nbContratsSignes || 0} contrats`);

    // Test avec le mois dernier
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const lastMonthContrats = await prisma.historiqueProspection.aggregate({
      where: {
        dateProspection: {
          gte: lastMonth,
          lt: startOfMonth
        }
      },
      _sum: {
        nbContratsSignes: true
      }
    });

    console.log(`Mois dernier (${lastMonth.toISOString()} - ${startOfMonth.toISOString()}): ${lastMonthContrats._sum.nbContratsSignes || 0} contrats`);

    console.log('\n🎉 TEST TERMINÉ !');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTimeFilters();
