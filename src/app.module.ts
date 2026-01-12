import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { VisaCheckerService } from './visa-checker.service';
import { AppointmentService } from './appointment.service';
import { AppService } from './app.service';

@Module({
  imports: [ScheduleModule.forRoot(), ConfigModule.forRoot()],
  controllers: [],
  providers: [AppService, VisaCheckerService, AppointmentService],
})
export class AppModule {}
