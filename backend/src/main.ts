import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CentralizedConfig } from './events/websocket.config';

async function bootstrap() {
  const sslPaths = CentralizedConfig.getSslPaths();
  const sslPath = process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, '..', 'ssl')
    : path.join(process.cwd(), 'ssl');
    
  try {
    // Essayer HTTPS d'abord
    const httpsOptions = {
      key: fs.readFileSync(path.join(sslPath, sslPaths.keyPath.split('/').pop()!)),
      cert: fs.readFileSync(path.join(sslPath, sslPaths.certPath.split('/').pop()!)),
    };

    const app = await NestFactory.create(AppModule, {
      httpsOptions,
      cors: CentralizedConfig.getCorsConfig(),
    });

    app.useGlobalPipes(new ValidationPipe());

    // Activer explicitement les WebSockets
    const server = app.getHttpServer();
    server.setTimeout(0); // Désactiver le timeout pour les WebSockets

    // Initialiser le service d'événements global avec le serveur IO
    try {
      const eventEmitterService = app.get('EventEmitterService');
      if (eventEmitterService && typeof eventEmitterService.setIoServer === 'function') {
        // Récupérer l'instance du serveur IO depuis Socket.IO
        const io = require('socket.io')(server);
        eventEmitterService.setIoServer(io);
        console.log('📡 Service d\'événements global initialisé avec le serveur IO');
      }
    } catch (error) {
      console.warn('⚠️ Impossible d\'initialiser le service d\'événements global:', error.message);
    }

    const port = process.env.API_PORT ?? 3000;
    await app.listen(port, '0.0.0.0');
    
    const debugInfo = CentralizedConfig.getDebugInfo();
    console.log(`🚀 HTTPS Server running on https://localhost:${port}`);
    console.log(`🌐 CORS Origins: ${debugInfo.corsOrigins}`);
    console.log(`🔧 Environment: ${debugInfo.environment}`);
    console.log(`🌍 Réseaux autorisés: ${debugInfo.allowedNetworks}`);
    console.log(`🤖 Gemini API: ${debugInfo.geminiApiKey}`);
    console.log(`📋 Variables d'environnement:`);
    Object.entries(debugInfo.envVars).forEach(([key, status]) => {
      console.log(`   ${status} ${key}`);
    });
  } catch (error) {
    console.error('HTTPS failed, starting HTTP fallback:', error);
    
    // Fallback HTTP
    const app = await NestFactory.create(AppModule);

    app.useGlobalPipes(new ValidationPipe());
    app.enableCors(CentralizedConfig.getCorsConfig());

    const port = process.env.API_PORT ?? 3000;
    await app.listen(port, '0.0.0.0');
    
    const debugInfo = CentralizedConfig.getDebugInfo();
    console.log(`HTTP Server running on http://localhost:${port}`);
    console.log(`🌐 CORS Origins: ${debugInfo.corsOrigins}`);
    console.log(`🔧 Environment: ${debugInfo.environment}`);
    console.log(`🌍 Réseaux autorisés: ${debugInfo.allowedNetworks}`);
    console.log(`🤖 Gemini API: ${debugInfo.geminiApiKey}`);
    console.log(`📋 Variables d'environnement:`);
    Object.entries(debugInfo.envVars).forEach(([key, status]) => {
      console.log(`   ${status} ${key}`);
    });
  }
}
bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
