# Exécution du seed en production

cd /home/ubuntu/frontetback/backend

npm run seed

pm2 restart backend

curl -k https://35.181.48.18/api/commerciaux

curl -k https://35.181.48.18/api/zones

curl -k https://35.181.48.18/api/immeubles