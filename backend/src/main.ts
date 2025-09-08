import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const sslPath = process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, '..', 'ssl')
    : path.join(process.cwd(), 'ssl');
    
  try {
    // Essayer HTTPS d'abord
    const httpsOptions = {
      key: fs.readFileSync(path.join(sslPath, '127.0.0.1+4-key.pem')),
      cert: fs.readFileSync(path.join(sslPath, '127.0.0.1+4.pem')),
    };

    const app = await NestFactory.create(AppModule, {
      httpsOptions,
      cors: {
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          // Allow requests with no origin (mobile apps, curl)
          if (!origin) return callback(null, true);
          
          // Origins from environment variables with fallbacks
          const localIp = process.env.LOCAL_IP;
          const frontendPort = process.env.FRONTEND_PORT || '5173';
          const productionIp = process.env.PRODUCTION_IP;
          const stagingIp = process.env.STAGING_IP;
          
          const allowed = [
            // Local development (with fallbacks)
            localIp ? `http://${localIp}:${frontendPort}` : 'http://localhost:5173',
            localIp ? `https://${localIp}:${frontendPort}` : 'https://localhost:5173',
            'http://127.0.0.1:5173',
            'https://127.0.0.1:5173',
            
            // Production (only if defined in .env)
            productionIp && `http://${productionIp}`,
            productionIp && `https://${productionIp}`,
            
            // Staging (only if defined in .env)
            stagingIp && `http://${stagingIp}`,
            stagingIp && `https://${stagingIp}`,
          ].filter(Boolean);
          
          if (allowed.includes(origin) || /^https?:\/\/192\.168\.[0-9]+\.[0-9]+(:\d+)?$/.test(origin)) {
            return callback(null, true);
          }
          return callback(new Error('Not allowed by CORS'));
        },
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
        preflightContinue: false,
        optionsSuccessStatus: 204,
      },
    });

    app.useGlobalPipes(new ValidationPipe());

    // Activer explicitement les WebSockets
    const server = app.getHttpServer();
    server.setTimeout(0); // Désactiver le timeout pour les WebSockets

    const port = process.env.API_PORT ?? 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 HTTPS Server running on https://localhost:${port}`);
    const corsOrigins = [
      process.env.LOCAL_IP ? `${process.env.LOCAL_IP}:${process.env.FRONTEND_PORT || '5173'}` : 'localhost:5173',
      '127.0.0.1:5173',
      process.env.PRODUCTION_IP,
      process.env.STAGING_IP,
    ].filter(Boolean).join(', ');
    console.log(`🌐 CORS Origins: ${corsOrigins}`);
  } catch (error) {
    console.error('HTTPS failed, starting HTTP fallback:', error);
    
    // Fallback HTTP
    const app = await NestFactory.create(AppModule);

    app.useGlobalPipes(new ValidationPipe());

    app.enableCors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);
        
        // Origins from environment variables with fallbacks
        const localIp = process.env.LOCAL_IP;
        const frontendPort = process.env.FRONTEND_PORT || '5173';
        const productionIp = process.env.PRODUCTION_IP;
        const stagingIp = process.env.STAGING_IP;
        
        const allowed = [
          // Local development (with fallbacks)
          localIp ? `http://${localIp}:${frontendPort}` : 'http://localhost:5173',
          localIp ? `https://${localIp}:${frontendPort}` : 'https://localhost:5173',
          'http://127.0.0.1:5173',
          'https://127.0.0.1:5173',
          
          // Production (only if defined in .env)
          productionIp && `http://${productionIp}`,
          productionIp && `https://${productionIp}`,
          
          // Staging (only if defined in .env)
          stagingIp && `http://${stagingIp}`,
          stagingIp && `https://${stagingIp}`,
        ].filter(Boolean);
        
        if (allowed.includes(origin) || /^https?:\/\/192\.168\.[0-9]+\.[0-9]+(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });

    const port = process.env.API_PORT ?? 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`HTTP Server running on http://localhost:${port}`);
    const corsOrigins = [
      process.env.LOCAL_IP ? `${process.env.LOCAL_IP}:${process.env.FRONTEND_PORT || '5173'}` : 'localhost:5173',
      '127.0.0.1:5173',
      process.env.PRODUCTION_IP,
      process.env.STAGING_IP,
    ].filter(Boolean).join(', ');
    console.log(`🌐 CORS Origins: ${corsOrigins}`);
  }
}
bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
