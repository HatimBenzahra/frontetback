const https = require('https');

// Function to make HTTPS requests
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      rejectUnauthorized: false // Accept self-signed certificates
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function testFilters() {
  console.log('🧪 Test des filtres temporels...\n');

  const periods = ['WEEKLY', 'MONTHLY', 'YEARLY'];
  
  try {
    for (const period of periods) {
      console.log(`📊 Test du filtre ${period}:`);
      console.log('─'.repeat(50));
      
      const response = await makeRequest(`/statistics?period=${period}`);
      
      console.log(`Total Contrats: ${response.totalContrats}`);
      console.log(`Total RDV: ${response.totalRdv}`);
      console.log(`Total Portes Visitées: ${response.totalPortesVisitees}`);
      console.log(`Taux de Conclusion: ${response.tauxConclusion?.toFixed(2)}%`);
      
      if (response.leaderboards && response.leaderboards.commerciaux.length > 0) {
        console.log(`Top Commercial: ${response.leaderboards.commerciaux[0].name} (${response.leaderboards.commerciaux[0].value} contrats)`);
      }
      
      console.log();
    }

    // Expected results based on our test data
    console.log('📋 Résultats attendus:');
    console.log('─'.repeat(50));
    console.log('WEEKLY (cette semaine):  3 contrats, 2 RDV');
    console.log('MONTHLY (ce mois):       8 contrats (3+5), 6 RDV (2+4)');
    console.log('YEARLY (cette année):    21 contrats (3+5+6+3+7), 17 RDV');
    console.log();
    
    console.log('💡 Si tous les filtres montrent les mêmes résultats, il y a un problème avec les filtres temporels!');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    console.log('💡 Assurez-vous que le serveur backend est démarré sur https://localhost:3000');
  }
}

testFilters();