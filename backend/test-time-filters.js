const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestData() {
  try {
    console.log('🎯 Création de données de test avec différentes dates...');

    // Get a commercial and an immeuble to use for test data
    const commercial = await prisma.commercial.findFirst();
    const immeuble = await prisma.immeuble.findFirst();

    if (!commercial || !immeuble) {
      console.error('❌ Pas de commercial ou d\'immeuble trouvé. Créez d\'abord des données de base.');
      return;
    }

    console.log(`📍 Utilisation du commercial: ${commercial.prenom} ${commercial.nom}`);
    console.log(`🏢 Utilisation de l'immeuble: ${immeuble.adresse}`);

    // Define test periods
    const now = new Date();
    const testPeriods = [
      {
        name: "Cette semaine",
        date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // Il y a 2 jours
        data: { nbPortesVisitees: 15, nbContratsSignes: 3, nbRdvPris: 2, nbRefus: 5, nbAbsents: 3, nbCurieux: 2 }
      },
      {
        name: "Semaine dernière",
        date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // Il y a 10 jours
        data: { nbPortesVisitees: 20, nbContratsSignes: 4, nbRdvPris: 3, nbRefus: 8, nbAbsents: 3, nbCurieux: 2 }
      },
      {
        name: "Ce mois",
        date: new Date(now.getFullYear(), now.getMonth(), 5), // Le 5 de ce mois
        data: { nbPortesVisitees: 25, nbContratsSignes: 5, nbRdvPris: 4, nbRefus: 10, nbAbsents: 4, nbCurieux: 2 }
      },
      {
        name: "Mois dernier",
        date: new Date(now.getFullYear(), now.getMonth() - 1, 15), // Le 15 du mois dernier
        data: { nbPortesVisitees: 30, nbContratsSignes: 6, nbRdvPris: 5, nbRefus: 12, nbAbsents: 5, nbCurieux: 2 }
      },
      {
        name: "Il y a 2 mois",
        date: new Date(now.getFullYear(), now.getMonth() - 2, 20), // Il y a 2 mois
        data: { nbPortesVisitees: 18, nbContratsSignes: 3, nbRdvPris: 2, nbRefus: 7, nbAbsents: 4, nbCurieux: 2 }
      },
      {
        name: "Cette année",
        date: new Date(now.getFullYear(), 1, 10), // Février de cette année
        data: { nbPortesVisitees: 35, nbContratsSignes: 7, nbRdvPris: 6, nbRefus: 15, nbAbsents: 5, nbCurieux: 2 }
      },
      {
        name: "Année dernière",
        date: new Date(now.getFullYear() - 1, 6, 15), // Juillet de l'année dernière
        data: { nbPortesVisitees: 40, nbContratsSignes: 8, nbRdvPris: 7, nbRefus: 18, nbAbsents: 5, nbCurieux: 2 }
      },
      {
        name: "Il y a 2 ans",
        date: new Date(now.getFullYear() - 2, 3, 20), // Avril d'il y a 2 ans
        data: { nbPortesVisitees: 22, nbContratsSignes: 4, nbRdvPris: 3, nbRefus: 9, nbAbsents: 4, nbCurieux: 2 }
      }
    ];

    // Clear existing test data (optional)
    console.log('🧹 Suppression des anciennes données de test...');
    await prisma.historiqueProspection.deleteMany({
      where: {
        commentaire: 'TEST_DATA'
      }
    });

    // Insert test data
    console.log('📊 Insertion des nouvelles données de test...');
    for (const period of testPeriods) {
      const dateProspection = new Date(period.date);
      dateProspection.setHours(0, 0, 0, 0);

      await prisma.historiqueProspection.create({
        data: {
          commercialId: commercial.id,
          immeubleId: immeuble.id,
          dateProspection: dateProspection,
          ...period.data,
          commentaire: 'TEST_DATA'
        }
      });

      console.log(`✅ ${period.name}: ${period.date.toLocaleDateString()} - ${period.data.nbContratsSignes} contrats, ${period.data.nbRdvPris} RDV`);
    }

    console.log('\n🎉 Données de test créées avec succès!');
    console.log('\n📋 Résumé des périodes:');
    console.log('─────────────────────────────────────────');
    
    testPeriods.forEach(period => {
      console.log(`${period.name.padEnd(20)} | ${period.date.toLocaleDateString()} | ${period.data.nbContratsSignes} contrats`);
    });

    console.log('\n🧪 Vous pouvez maintenant tester les filtres:');
    console.log('• WEEKLY - devrait montrer les données de cette semaine');
    console.log('• MONTHLY - devrait montrer les données de ce mois');  
    console.log('• YEARLY - devrait montrer les données de cette année');

  } catch (error) {
    console.error('❌ Erreur lors de la création des données de test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();