import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set before the API can start.');
  }
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global input validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // OpenAPI / Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('AuraBank Core Banking Engine API')
    .setDescription(
      'Moteur bancaire virtuel haute performance avec Grand Livre en partie double (Double-Entry Ledger), ' +
      'idempotence, contrôle de concurrence pessimiste, détection de fraude, cartes virtuelles et simulateur de trafic.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  if (process.env.SWAGGER_ENABLED !== 'false') {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'AuraBank API Docs',
    });
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  logger.log(`🚀 AuraBank Backend opérationnel sur : http://localhost:${port}/api`);
  logger.log(`📚 Documentation Swagger OpenAPI : http://localhost:${port}/api/docs`);
}

bootstrap();
