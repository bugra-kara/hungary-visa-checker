import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppService } from './app.service';
import { VisaCheckerService } from './visa-checker.service';

@Module({
  imports: [HttpModule, ScheduleModule.forRoot(), ConfigModule.forRoot()],
  controllers: [],
  providers: [AppService, VisaCheckerService],
})
export class AppModule {}
