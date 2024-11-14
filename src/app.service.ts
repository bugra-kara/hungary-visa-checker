import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VisaCheckerService } from './visa-checker.service';

@Injectable()
export class AppService {
  constructor(private readonly visaCheckerService: VisaCheckerService) {}

  @Cron('*/15 * * * * *') // Her 15 saniyede bir çalışır
  handleCron() {
    this.visaCheckerService.checkVisaDate();
  }
}
