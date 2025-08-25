// Script de test pour vérifier les filtres de temps via l'API
const https = require('https');

// Configuration pour ignorer les certificats SSL auto-signés
const agent = new https.Agent({
  rejectUnauthorized: false
});

async function testAPI(period) {
  return new Promise((resolve) => {
    const url = `https://localhost:3000/statistics?period=${period}`;
    
    https.get(url, { agent }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            period,
            totalContrats: jsonData.totalContrats,
            totalRdv: jsonData.totalRdv,
            totalPortesVisitees: jsonData.totalPortesVisitees,
            tauxConclusion: jsonData.tauxConclusion
          });
        } catch (error) {
          resolve({
            period,
            error: `Erreur parsing JSON: ${error.message}`,
            rawData: data
          });
        }
      });
    }).on('error', (error) => {
      resolve({
        period,
        error: `Erreur réseau: ${error.message}`
      });
    });
  });
}

async function testAllFilters() {
  console.log('🧪 TEST DES FILTRES DE TEMPS VIA L\'API\n');
  
  const periods = ['WEEKLY', 'MONTHLY', 'YEARLY'];
  const results = [];
  
  for (const period of periods) {
    console.log(`⏳ Test du filtre ${period}...`);
    const result = await testAPI(period);
    results.push(result);
    
    if (result.error) {
      console.log(`❌ ${period}: ${result.error}`);
    } else {
      console.log(`✅ ${period}:`);
      console.log(`   - Contrats: ${result.totalContrats}`);
      console.log(`   - RDV: ${result.totalRdv}`);
      console.log(`   - Portes visitées: ${result.totalPortesVisitees}`);
      console.log(`   - Taux conclusion: ${result.tauxConclusion.toFixed(2)}%`);
    }
    console.log('');
  }
  
  // Vérification de cohérence
  console.log('🔍 VÉRIFICATION DE COHÉRENCE:');
  const validResults = results.filter(r => !r.error);
  
  if (validResults.length === 3) {
    const weekly = validResults.find(r => r.period === 'WEEKLY');
    const monthly = validResults.find(r => r.period === 'MONTHLY');
    const yearly = validResults.find(r => r.period === 'YEARLY');
    
    console.log(`- Semaine ≤ Mois: ${weekly.totalContrats <= monthly.totalContrats ? '✅' : '❌'}`);
    console.log(`- Mois ≤ Année: ${monthly.totalContrats <= yearly.totalContrats ? '✅' : '❌'}`);
    console.log(`- Semaine ≤ Année: ${weekly.totalContrats <= yearly.totalContrats ? '✅' : '❌'}`);
    
    // Test de logique temporelle
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;
    startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    console.log('\n📅 DATES DE DÉBUT CALCULÉES:');
    console.log(`- Semaine: ${startOfWeek.toISOString()}`);
    console.log(`- Mois: ${startOfMonth.toISOString()}`);
    console.log(`- Année: ${startOfYear.toISOString()}`);
    
    // Vérification que les dates sont logiques
    console.log('\n✅ VÉRIFICATION DES DATES:');
    console.log(`- Début semaine ≤ Début mois: ${startOfWeek <= startOfMonth ? '✅' : '❌'}`);
    console.log(`- Début mois ≤ Début année: ${startOfMonth <= startOfYear ? '✅' : '❌'}`);
    console.log(`- Début semaine ≤ Début année: ${startOfWeek <= startOfYear ? '✅' : '❌'}`);
    
  } else {
    console.log('❌ Impossible de vérifier la cohérence - erreurs dans les requêtes');
  }
  
  console.log('\n🎉 TEST TERMINÉ !');
}

// Test avec des requêtes multiples pour vérifier la stabilité
async function testStability() {
  console.log('\n🔄 TEST DE STABILITÉ (3 requêtes consécutives):');
  
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- Test ${i} ---`);
    const result = await testAPI('WEEKLY');
    if (result.error) {
      console.log(`❌ Erreur: ${result.error}`);
    } else {
      console.log(`✅ Contrats: ${result.totalContrats}`);
    }
  }
}

// Exécution des tests
async function runTests() {
  await testAllFilters();
  await testStability();
}

runTests().catch(console.error);
