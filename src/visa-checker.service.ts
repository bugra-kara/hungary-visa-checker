import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as NodeCache from 'node-cache';

@Injectable()
export class VisaCheckerService {
  private readonly logger = new Logger(VisaCheckerService.name);

  // URL for the API endpoint to fetch visa dates
  private readonly url =
    'https://appointment.as-visa.com/Macaristan/TarihGetir';

  // Variables to store Telegram chat ID and bot token
  private readonly chatId: string;
  private readonly botToken: string;

  // In-memory cache with a default TTL (time-to-live) of 24 hours
  private readonly cache: NodeCache;

  constructor(private readonly configService: ConfigService) {
    this.chatId = this.configService.get<string>('CHAT_ID');
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    // Initializing the cache with a TTL of 24 hours
    this.cache = new NodeCache({ stdTTL: 60 * 60 * 24 });
  }

  // Function to check for available visa dates
  async checkVisaDate(): Promise<void> {
    // Data payload for the POST request
    const data =
      'tabId=Macaristan+Bireysel+Randevu+(C)&countryid=T%C3%9CRK%C4%B0YE';

    try {
      const response = await axios.post(this.url, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
      });

      const dates = await response.data;

      // Checking if there are available dates
      if (dates.length) {
        for (const date of dates) {
          const cacheKey = `date_${date}`; // Creating a unique cache key for each date
          const cacheData = this.cache.get(cacheKey); // Checking if the date is already cached

          // If the date is not cached, send a Telegram notification and cache the date
          if (!cacheData) {
            await this.sendTelegramNotification(
              `The new application date has arrived! Date: ${date}`,
            );
            this.cache.set(cacheKey, date); // Storing the date in the cache
          }
        }
      }
    } catch (error) {
      this.logger.error('Error: ', error.toString());
    }
  }

  // Function to send a notification message via Telegram
  async sendTelegramNotification(message: string): Promise<void> {
    const telegramUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage?chat_id=-${this.chatId}&text=${message}`;
    try {
      await axios.post(telegramUrl);
      this.logger.log('Telegram notification is sent!');
    } catch (error) {
      this.logger.error(
        'Error while sending telegram notification send!',
        error.message,
      );
    }
  }
}
