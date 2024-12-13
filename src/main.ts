import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = 4343;
  await app.listen(port);
  Logger.log(`Application is running on: ${port}`);
}
bootstrap();
