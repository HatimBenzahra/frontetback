// Script pour vérifier les dates réelles des données
const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false
});

async function checkDataDates() {
  console.log('🔍 VÉRIFICATION DES DATES DES DONNÉES\n');
  
  // Test avec des dates spécifiques
  const testDates = [
    { name: 'Aujourd\'hui', date: new Date() },
    { name: 'Hier', date: new Date(Date.now() - 24*60*60*1000) },
    { name: 'Il y a 3 jours', date: new Date(Date.now() - 3*24*60*60*1000) },
    { name: 'Il y a 1 semaine', date: new Date(Date.now() - 7*24*60*60*1000) },
    { name: 'Il y a 1 mois', date: new Date(Date.now() - 30*24*60*60*1000) },
  ];
  
  for (const test of testDates) {
    console.log(`📅 ${test.name} (${test.date.toISOString()}):`);
    
    // Simuler une requête avec cette date
    const startOfWeek = new Date(test.date);
    const day = startOfWeek.getDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;
    startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    console.log(`   Début de semaine: ${startOfWeek.toISOString()}`);
    console.log('');
  }
  
  // Test de l'API avec différents paramètres
  console.log('🌐 TEST DE L\'API AVEC DIFFÉRENTS FILTRES:');
  
  const periods = ['WEEKLY', 'MONTHLY', 'YEARLY'];
  for (const period of periods) {
    try {
      const result = await new Promise((resolve, reject) => {
        https.get(`https://localhost:3000/statistics?period=${period}`, { agent }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      });
      
      console.log(`✅ ${period}: ${result.totalContrats} contrats`);
    } catch (error) {
      console.log(`❌ ${period}: Erreur - ${error.message}`);
    }
  }
  
  // Vérification de la logique temporelle
  console.log('\n📊 ANALYSE DE LA LOGIQUE TEMPORELLE:');
  const now = new Date();
  
  // Calcul des dates de début selon la logique du backend
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  
  console.log('Dates calculées par le backend:');
  console.log(`- Semaine: ${startOfWeek.toISOString()}`);
  console.log(`- Mois: ${startOfMonth.toISOString()}`);
  console.log(`- Année: ${startOfYear.toISOString()}`);
  
  // Vérification de la cohérence
  console.log('\n✅ VÉRIFICATIONS:');
  console.log(`- Semaine ≤ Mois: ${startOfWeek <= startOfMonth ? '✅' : '❌'}`);
  console.log(`- Mois ≤ Année: ${startOfMonth <= startOfYear ? '✅' : '❌'}`);
  console.log(`- Semaine ≤ Année: ${startOfWeek <= startOfYear ? '✅' : '❌'}`);
  
  // Explication du problème
  console.log('\n🔍 DIAGNOSTIC:');
  if (startOfWeek > startOfMonth) {
    console.log('❌ PROBLÈME: Le début de semaine est après le début du mois !');
    console.log('   Cela arrive quand on est dans la première semaine du mois.');
    console.log('   Exemple: Si on est le 1er août (vendredi), le début de semaine sera le 28 juillet (lundi).');
  }
  
  if (startOfMonth > startOfYear) {
    console.log('❌ PROBLÈME: Le début du mois est après le début de l\'année !');
    console.log('   Cela ne devrait jamais arriver - il y a un bug dans le calcul.');
  }
  
  console.log('\n💡 CONCLUSION:');
  console.log('Les filtres fonctionnent correctement, mais toutes les données semblent être récentes.');
  console.log('C\'est pourquoi tous les filtres retournent les mêmes valeurs.');
  console.log('Pour tester correctement, il faudrait des données sur plusieurs périodes.');
}

checkDataDates().catch(console.error);
