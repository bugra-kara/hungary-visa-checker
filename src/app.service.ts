import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VisaCheckerService } from './visa-checker.service';

@Injectable()
export class AppService {
  constructor(private readonly visaCheckerService: VisaCheckerService) {}

  // Schedules a task to run every 15 seconds
  @Cron('*/15 * * * * *')
  handleCron() {
    // Calls the checkVisaDate method of the VisaCheckerService
    this.visaCheckerService.checkVisaDate();
  }
}
