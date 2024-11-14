import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(bodyParser.json());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
  app.enableCors({
    origin: (origin, callback) => {
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['OPTIONS'],
    credentials: true,
  });
  const globalPrefix = 'api';
  const port = 4343;

  app.setGlobalPrefix(globalPrefix);

  app.use(helmet());
  app.use(express.json());
  await app.listen(port);
  Logger.log(`Application is running on: ${port}`);
}
bootstrap();
