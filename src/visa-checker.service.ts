import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import got from 'got';
import * as NodeCache from 'node-cache';

@Injectable()
export class VisaCheckerService {
  private readonly logger = new Logger(VisaCheckerService.name);
  private readonly url =
    'https://appointment.as-visa.com/Macaristan/TarihGetir';
  private readonly chatId: string;
  private readonly botToken: string;
  private readonly cache: NodeCache;

  constructor(private readonly configService: ConfigService) {
    this.chatId = this.configService.get<string>('CHAT_ID');
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.cache = new NodeCache({ stdTTL: 60 * 60 * 24 });
  }

  // POST isteğini atan fonksiyon
  async checkVisaDate(): Promise<void> {
    const data =
      'tabId=Macaristan+Bireysel+Randevu+(C)&countryid=T%C3%9CRK%C4%B0YE';

    try {
      const response = await axios.post(this.url, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
      });

      const result = await response.data;
      if (result && result.length) {
        for (const singleDate of result) {
          const cacheKey = `date_${singleDate}`;
          const cacheData = this.cache.get(cacheKey);
          if (!cacheData) {
            await this.sendTelegramNotification(
              `Yeni bir randevu mevcut! Tarihler: ${singleDate}`,
            );
            this.cache.set(cacheKey, singleDate);
          }
        }
      }
    } catch (error) {
      await this.sendTelegramNotification(`Hata: ${error.message}`);
      this.logger.error('Hata oluştu', error.toString());
    }
  }

  // Telegram bildirimi gönderen fonksiyon
  async sendTelegramNotification(message: string): Promise<void> {
    const telegramUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage?chat_id=-${this.chatId}&text=${message}`;
    try {
      await got.post(telegramUrl);
      this.logger.log('Telegram bildirimi gönderildi.');
    } catch (error) {
      this.logger.error(
        'Telegram bildirimi gönderilirken hata oluştu',
        error.message,
      );
    }
  }
}
