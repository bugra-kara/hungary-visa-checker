import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as NodeCache from 'node-cache';
import { AppointmentService } from './appointment.service';

@Injectable()
export class VisaCheckerService {
  private readonly logger = new Logger(VisaCheckerService.name);

  // URL for the API endpoint to fetch visa dates
  private readonly url =
    'https://appointment.as-visa.com/Macaristan/TarihGetir';

  // Variables to store Telegram chat ID and bot token
  private readonly chatId: string;
  private readonly botToken: string;
  private isActive: boolean;

  // Target appointment configuration
  private readonly targetDates: string[];
  private readonly targetTimes: string[];

  // User data for appointment booking
  private readonly userData: any;

  // In-memory cache with a default TTL (time-to-live) of 24 hours
  private readonly cache: NodeCache;

  constructor(
    private readonly configService: ConfigService,
    private readonly appointmentService: AppointmentService,
  ) {
    this.chatId = this.configService.get<string>('CHAT_ID');
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    // Parse target dates from comma-separated string
    const targetDatesStr = this.configService.get<string>('TARGET_DATES');
    this.targetDates = targetDatesStr
      ? targetDatesStr.split(',').map((d) => d.trim())
      : ['16/02/2026', '17/02/2026', '18/02/2026'];

    // Parse target times from comma-separated string
    const targetTimesStr = this.configService.get<string>('TARGET_TIMES');
    this.targetTimes = targetTimesStr
      ? targetTimesStr.split(',').map((t) => t.trim())
      : ["10:30", '10:45', '11:00', '11:15', '11:30', '11:45', '12:00'];

    // User data from env variables
    this.userData = {
      tcKimlikNo: this.configService.get<string>('TC_KIMLIK_NO'),
      passportNumber: this.configService.get<string>('PASSPORT_NUMBER'),
      name: this.configService.get<string>('NAME'),
      surname: this.configService.get<string>('SURNAME'),
      phone: this.configService.get<string>('PHONE'),
      email: this.configService.get<string>('EMAIL'),
      birthYear: this.configService.get<string>('BIRTH_YEAR'),
      travelDate: this.configService.get<string>('TRAVEL_DATE'),
      travelSubject:
        this.configService.get<string>('TRAVEL_SUBJECT') || 'Turist',
      verificationCode: this.configService.get<string>('VERIFICATION_CODE'),
      requestVerificationToken: this.configService.get<string>(
        'REQUEST_VERIFICATION_TOKEN',
      ),
      cookie: this.configService.get<string>('COOKIE'),
    };

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

      const dates = await response.data

      if (!this.isActive) {
        this.isActive = true;
        await this.sendTelegramNotification('Visa checker bot is running!');
      }

      // Checking if there are available dates
      if (dates.length) {
        for (const date of dates) {
          const cacheKey = `date_${date}`; // Creating a unique cache key for each date
          const cacheData = this.cache.get(cacheKey); // Checking if the date is already cached

          // If the date is not cached, send a Telegram notification and cache the date
          if (!cacheData) {
            this.appointmentService.startTokenProducers();
            this.logger.log('Token producers started in background');
            await this.sendTelegramNotification(
              `The new application date has arrived! Date: ${date} - Token producers started in background`,
            );
            this.cache.set(cacheKey, date); // Storing the date in the cache

            // Check if this date is one of our target dates
            if (this.targetDates.includes(date)) {
              this.logger.log(
                `🎯 Target date found: ${date}! Starting appointment booking...`,
              );
              await this.sendTelegramNotification(
                `🎯 Target date ${date} found! Will try times: ${this.targetTimes.join(', ')}`,
              );

              // Wait for first token pair if not ready yet
              await this.appointmentService.waitForFirstTokenPair();

              // Try each time slot until one succeeds
              let bookingSuccessful = false;
              for (const targetTime of this.targetTimes) {
                if (bookingSuccessful) break;

                this.logger.log(
                  `Attempting to book appointment for ${date} at ${targetTime}...`,
                );
                await this.sendTelegramNotification(
                  `⏰ Trying time slot: ${targetTime}`,
                );

                try {
                  const result =
                    await this.appointmentService.submitAppointment(
                      date,
                      targetTime,
                      this.userData,
                    );

                  await this.sendTelegramNotification(
                    `✅ SUCCESS! Appointment booked for ${date} ${targetTime}\n\nResponse: ${JSON.stringify(result, null, 2)}`,
                  );
                  this.logger.log(
                    `Appointment booking successful for ${targetTime}!`,
                  );
                  bookingSuccessful = true;
                  break;
                } catch (error) {
                  // Check if it's a time slot full error
                  if (error.message.startsWith('TIME_SLOT_FULL')) {
                    await this.sendTelegramNotification(
                      `⏭️  Time ${targetTime} is full, trying next slot...`,
                    );
                    this.logger.warn(
                      `Time slot ${targetTime} is full, moving to next slot`,
                    );
                    // Continue to next time slot immediately
                    continue;
                  }

                  // For other errors, still notify but continue trying next slots
                  await this.sendTelegramNotification(
                    `❌ Failed to book time ${targetTime}: ${error.message}`,
                  );
                  this.logger.warn(
                    `Appointment booking failed for ${targetTime}, trying next slot...`,
                  );
                  // Continue to next time slot
                }
              }

              // If no slot was successful for this date
              if (!bookingSuccessful) {
                await this.sendTelegramNotification(
                  `❌ All time slots failed for ${date}. ${
                    this.targetDates.indexOf(date) < this.targetDates.length - 1
                      ? 'Will wait for next target date.'
                      : 'No more target dates available.'
                  }`,
                );
                this.logger.warn(
                  `All appointment time slots failed for ${date}`,
                );
              }
            }
          }
        }
      }
    } catch (error) {
      this.sendTelegramNotification(error.toString());
      this.logger.error('Error: ', error.toString());
    }
  }

  // Function to send a notification message via Telegram
  async sendTelegramNotification(message: string): Promise<void> {
    const telegramUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage?chat_id=-${this.chatId}&text=${encodeURIComponent(message)}`;
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
