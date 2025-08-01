# Correction finale des URLs frontend

cd /home/ubuntu/frontetback/moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b

cat > .env << 'EOF'
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiYmVuemFocmEiLCJhIjoiY21heG85dnd0MDBjbTJuc2RhbWhhOWxsMyJ9.XZm932vHWSs-cHO9lmtmKg

# URLs via nginx proxy (SANS PORT)
VITE_API_URL=https://35.181.48.18/api
VITE_SOCKET_URL=wss://35.181.48.18
VITE_PYTHON_SERVER_URL=https://35.181.48.18/python

# Configuration des adresses réseau
VITE_SERVER_HOST=35.181.48.18
VITE_API_PORT=443
VITE_PYTHON_HTTP_PORT=8000
VITE_PYTHON_HTTPS_PORT=8443

# Deepgram API pour la transcription
VITE_DEEPGRAM_API_KEY=7189f2a24e42949bf3a561b9a89328de00526605
EOF

sudo chown -R ubuntu:ubuntu dist

npm run build

sudo chown -R www-data:www-data dist

sudo chmod -R 755 dist

sudo systemctl reload nginx