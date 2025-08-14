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
          const allowed = [
            `https://${process.env.LOCALHOST_DEV}:${process.env.FRONTEND_PORT}`,
            `https://${process.env.LOCALHOST_IP}:${process.env.FRONTEND_PORT}`,
            `https://${process.env.CLIENT_HOST}:${process.env.FRONTEND_PORT}`,
            `http://${process.env.LOCALHOST_DEV}:${process.env.FRONTEND_PORT}`,
            `http://${process.env.LOCALHOST_IP}:${process.env.FRONTEND_PORT}`,
            `http://${process.env.CLIENT_HOST}:${process.env.FRONTEND_PORT}`,
            `https://${process.env.PRODUCTION_IP}`,
            `http://${process.env.PRODUCTION_IP}`,
            'http://192.168.120:5173',
            'https://192.168.1.120:5173',
            'http://192.168.1.120:3000',
            'https://192.168.1.120:3000',
            'https://13.39.149.200',
            'http://13.39.149.200',
          ];
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
  } catch (error) {
    console.error('HTTPS failed, starting HTTP fallback:', error);
    
    // Fallback HTTP
    const app = await NestFactory.create(AppModule);

    app.useGlobalPipes(new ValidationPipe());

    app.enableCors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);
        const allowed = [
          `http://${process.env.LOCALHOST_DEV}:${process.env.FRONTEND_PORT}`,
          `http://${process.env.LOCALHOST_IP}:${process.env.FRONTEND_PORT}`,
          `http://${process.env.CLIENT_HOST}:${process.env.FRONTEND_PORT}`,
          `https://${process.env.LOCALHOST_DEV}:${process.env.FRONTEND_PORT}`,
          `https://${process.env.LOCALHOST_IP}:${process.env.FRONTEND_PORT}`,
          `https://${process.env.CLIENT_HOST}:${process.env.FRONTEND_PORT}`,
          `https://${process.env.PRODUCTION_IP}`,
          `http://${process.env.PRODUCTION_IP}`,
          'http://192.168.1.120:5173',
          'https://192.168.1.120:5173',
          'http://192.168.1.120:3000',
          'https://192.168.1.120:3000',
          'https://13.39.149.200',
          'http://13.39.149.200',
        ];
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
  }
}
bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
