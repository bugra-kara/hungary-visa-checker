import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as FormData from 'form-data';

const ac = require('@antiadmin/anticaptchaofficial');

interface TokenPair {
  turnstileToken: string;
  recaptchaToken: string;
}

interface AppointmentConfig {
  targetUrl: string;
  turnstileSiteKey: string;
  recaptchaSiteKey: string;
  tokenQueueSize: number;
}

class TokenQueue {
  private queue: string[] = [];
  private readonly maxSize: number;
  private readonly name: string;

  constructor(name: string, maxSize: number = 5) {
    this.name = name;
    this.maxSize = maxSize;
  }

  add(token: string): void {
    this.queue.push(token);
  }

  get(): string | null {
    if (this.queue.length === 0) {
      return null;
    }
    return this.queue.shift();
  }

  isFull(): boolean {
    return this.queue.length >= this.maxSize;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  size(): number {
    return this.queue.length;
  }

  async waitForToken(): Promise<string> {
    while (this.isEmpty()) {
      await this.sleep(100);
    }
    return this.get();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  private readonly config: AppointmentConfig = {
    targetUrl: 'https://appointment.as-visa.com/tr/istanbul-bireysel-basvuru',
    turnstileSiteKey: '0x4AAAAAABdidRUErm8HlBu9',
    recaptchaSiteKey: '6Lf22HgrAAAAAP3u20U_HvrMsqmtltl7HcpezMWj',
    tokenQueueSize: 3,
  };

  private readonly turnstileQueue: TokenQueue;
  private readonly recaptchaQueue: TokenQueue;

  private readonly antiCaptchaApiKey: string;
  private producersStarted = false;

  constructor(private readonly configService: ConfigService) {
    this.antiCaptchaApiKey = this.configService.get<string>(
      'ANTI_CAPTCHA_API_KEY',
    );

    // Initialize Anti-Captcha
    ac.setAPIKey(this.antiCaptchaApiKey);
    ac.setSoftId(0);

    // Initialize token queues
    this.turnstileQueue = new TokenQueue(
      'Turnstile',
      this.config.tokenQueueSize,
    );
    this.recaptchaQueue = new TokenQueue(
      'ReCaptcha',
      this.config.tokenQueueSize,
    );
  }

  /**
   * Start token producers in background
   */
  startTokenProducers(): void {
    if (this.producersStarted) {
      return;
    }

    this.logger.log('Starting token producers...');
    this.producersStarted = true;

    // Initialize queues with 5 tokens in parallel
    this.initializeTokenQueues();

    // Start continuous producers
    this.produceTurnstileTokens();
    this.produceRecaptchaTokens();
  }

  /**
   * Initialize token queues with 5 tokens each in parallel
   */
  private async initializeTokenQueues(): Promise<void> {
    this.logger.log('Initializing token queues with 5 tokens each...');

    // Create 5 turnstile tokens in parallel
    const turnstilePromises = Array.from({ length: 3 }, async (_, i) => {
      try {
        this.logger.debug(`[Init] Starting Turnstile token #${i + 1}...`);
        const startTime = Date.now();

        const token = await ac.solveTurnstileProxyless(
          this.config.targetUrl,
          this.config.turnstileSiteKey,
        );

        const duration = this.formatDuration(Date.now() - startTime);
        this.logger.debug(
          `[Init] Turnstile token #${i + 1} ready in ${duration}`,
        );
        this.turnstileQueue.add(token);
      } catch (error) {
        this.logger.error(
          `[Init] Turnstile token #${i + 1} failed: ${error.message}`,
        );
      }
    });

    // Create 5 recaptcha tokens in parallel
    const recaptchaPromises = Array.from({ length: 3 }, async (_, i) => {
      try {
        this.logger.debug(`[Init] Starting ReCaptcha token #${i + 1}...`);
        const startTime = Date.now();

        const token = await ac.solveRecaptchaV3(
          this.config.targetUrl,
          this.config.recaptchaSiteKey,
          0.9,
          'appointment_submit',
        );

        const duration = this.formatDuration(Date.now() - startTime);
        this.logger.debug(
          `[Init] ReCaptcha token #${i + 1} ready in ${duration}`,
        );
        this.recaptchaQueue.add(token);
      } catch (error) {
        this.logger.error(
          `[Init] ReCaptcha token #${i + 1} failed: ${error.message}`,
        );
      }
    });

    // Don't wait for completion - let them run in background
    Promise.all([...turnstilePromises, ...recaptchaPromises]).then(() => {
      this.logger.log(
        `Token queue initialization completed. Turnstile: ${this.turnstileQueue.size()}, ReCaptcha: ${this.recaptchaQueue.size()}`,
      );
    });
  }

  /**
   * Produce Turnstile tokens continuously
   */
  private async produceTurnstileTokens(): Promise<void> {
    let producedCount = 0;

    while (true) {
      if (this.turnstileQueue.isFull()) {
        await this.sleep(500);
        continue;
      }

      const startTime = Date.now();
      try {
        producedCount++;
        this.logger.debug(`[Turnstile] Generating token #${producedCount}...`);

        const token = await ac.solveTurnstileProxyless(
          this.config.targetUrl,
          this.config.turnstileSiteKey,
        );

        const duration = this.formatDuration(Date.now() - startTime);
        this.logger.debug(
          `[Turnstile] ✓ Token #${producedCount} ready in ${duration}`,
        );

        this.turnstileQueue.add(token);
      } catch (error) {
        const duration = this.formatDuration(Date.now() - startTime);
        this.logger.error(
          `[Turnstile] ✗ Failed after ${duration}: ${error.message}`,
        );
        await this.sleep(1000);
      }
    }
  }

  /**
   * Produce ReCaptcha V3 tokens continuously
   */
  private async produceRecaptchaTokens(): Promise<void> {
    let producedCount = 0;

    while (true) {
      if (this.recaptchaQueue.isFull()) {
        await this.sleep(500);
        continue;
      }

      const startTime = Date.now();
      try {
        producedCount++;
        this.logger.debug(`[ReCaptcha] Generating token #${producedCount}...`);

        const token = await ac.solveRecaptchaV3(
          this.config.targetUrl,
          this.config.recaptchaSiteKey,
          0.9,
          'appointment_submit',
        );

        const duration = this.formatDuration(Date.now() - startTime);
        this.logger.debug(
          `[ReCaptcha] ✓ Token #${producedCount} ready in ${duration}`,
        );

        this.recaptchaQueue.add(token);
      } catch (error) {
        const duration = this.formatDuration(Date.now() - startTime);
        this.logger.error(
          `[ReCaptcha] ✗ Failed after ${duration}: ${error.message}`,
        );
        await this.sleep(1000);
      }
    }
  }

  /**
   * Wait for first token pair to be available
   */
  async waitForFirstTokenPair(): Promise<void> {
    this.logger.log('Waiting for first token pair...');

    while (this.turnstileQueue.isEmpty() || this.recaptchaQueue.isEmpty()) {
      await this.sleep(100);
    }

    this.logger.log('First token pair ready!');
  }

  /**
   * Get a token pair from queues
   */
  async getTokenPair(): Promise<TokenPair> {
    const turnstileToken = await this.turnstileQueue.waitForToken();
    const recaptchaToken = await this.recaptchaQueue.waitForToken();

    return { turnstileToken, recaptchaToken };
  }

  /**
   * Submit appointment booking
   */
  async submitAppointment(
    appointmentDate: string,
    appointmentTime: string,
    formData: any,
  ): Promise<any> {
    this.logger.log(
      `Attempting appointment booking for ${appointmentDate} ${appointmentTime}`,
    );

    const maxRetries = 10;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      this.logger.log(`Attempt ${attempt}/${maxRetries}`);

      try {
        // Get token pair
        this.logger.debug('Fetching token pair from queue...');
        const tokens = await this.getTokenPair();
        this.logger.debug(
          `Queue sizes: Turnstile=${this.turnstileQueue.size()}, ReCaptcha=${this.recaptchaQueue.size()}`,
        );

        // Send request
        const result = await this.sendAppointmentRequest(
          tokens,
          appointmentDate,
          appointmentTime,
          formData,
        );

        if (result.success) {
          this.logger.log('✓ Appointment booking successful!');
          return result.data;
        }

        // Check if error is retryable
        if (!result.retryable) {
          throw new Error(`Non-retryable error: ${result.error}`);
        }

        // If quota is full for this specific time, don't retry - let caller try next time
        if (result.error.includes('kontenjan dolmuştur')) {
          throw new Error(`TIME_SLOT_FULL: ${result.error}`);
        }

        this.logger.warn(`Request failed: ${result.error}. Retrying...`);
        await this.sleep(2000); // 2 seconds delay between attempts
      } catch (error) {
        // If it's a time slot full error or non-retryable, throw immediately
        if (
          error.message.startsWith('TIME_SLOT_FULL') ||
          error.message.startsWith('Non-retryable')
        ) {
          throw error;
        }

        this.logger.error(`Attempt ${attempt} failed: ${error.message}`);
        if (attempt >= maxRetries) {
          throw error;
        }
        await this.sleep(2000); // 2 seconds delay between attempts
      }
    }

    throw new Error('Max retries reached');
  }

  /**
   * Send appointment request
   */
  private async sendAppointmentRequest(
    tokens: TokenPair,
    appointmentDate: string,
    appointmentTime: string,
    userData: any,
  ): Promise<any> {
    const startTime = Date.now();
    const form = new FormData();

    // Add form fields
    form.append('Nationality', 'TÜRKİYE');
    form.append('Appointment', 'Macaristan Bireysel Randevu (C)');
    form.append('TravelDate', userData.travelDate || '09/03/2026');
    form.append('TravelSubject', 'Turist');
    form.append('AppointmentDate', appointmentDate);
    form.append('AppointmentTime', appointmentTime);
    form.append('TcKimlikNo', userData.tcKimlikNo);
    form.append('reTCKN', userData.tcKimlikNo);
    form.append('PassaportNumber', userData.passportNumber);
    form.append('Name', userData.name);
    form.append('Surname', userData.surname);
    form.append('Phone', userData.phone);
    form.append('Email', userData.email);
    form.append('reEmail', userData.email);
    form.append('rEmail', userData.email);
    form.append('DogumYili', userData.birthYear);
    form.append('enteredCode', '302723');
    form.append('verificationCodeServer', 'undefined');
    form.append(
      '__RequestVerificationToken',
      'CfDJ8MIr1_jtFSJGpk9sXoCrf04wZkQ4_rMwPqtehhorhX4k3LYRtKedr8mfxLeOHZVTg8KKxUhW0Ow2XTq2OJVckRSSuUET__zt4TSQF_NEvO-c1Ly0Ajzb0wNxGrUpl6kQqjiyqzSKEfJZrr0WBMt3pc4',
    );
    form.append('formStartTime', (Date.now() - 100000).toString());
    form.append('cfToken', tokens.turnstileToken);
    form.append('lessThan15Days', 'false');
    form.append('recaptchaToken', tokens.recaptchaToken);

    const headers = {
      ...form.getHeaders(),
      Cookie: '_ga_KQC6SY9TRV=GS2.1.s1768239579$o1$g1$t1768239586$j53$l0$h0; _ga=GA1.1.1142028672.1768239580; _gid=GA1.2.177939285.1768239580; .AspNetCore.Antiforgery.mEZFPqlrlZ8=CfDJ8MIr1_jtFSJGpk9sXoCrf04OHtLbDpSD2_AIPHsdLUKJQgq1QA6YMHdboHSu8hGIvptpirjMZ1lk0oU_GFJZCII48v1topspqVZKEPwOlBSLj23AplEfqR5o64iSjpCt56-i8wkMj5UhbfaJw24nF6E; .AspNetCore.Mvc.CookieTempDataProvider=CfDJ8MIr1_jtFSJGpk9sXoCrf05HWEMHM8uIZZwN0RDxk7uFF2eOtbAWp_m7ZNunb8xZUnwMuFy_9OUKujSs4aL8pbDPMh4iogktkNe3KOGzS-h1rwhGCUJxWD1Vv7-5CB3z8LW6aujnCy1n95dWfVsRlm0',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
      'X-Requested-With': 'XMLHttpRequest',
      Origin: 'https://appointment.as-visa.com',
      'Referer': 'https://appointment.as-visa.com/tr/istanbul-bireysel-basvuru',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'Te': 'trailers',
      'Connection': 'keep-alive'
    };

    try {
      const config = {
        method: "post",
        url: this.config.targetUrl,
        headers,
        data: form
      }
      const response = await axios.request(config);

      const duration = this.formatDuration(Date.now() - startTime);
      this.logger.log(`Request successful in ${duration}`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      if (error.response) {
        // Try to get error message
        const errorMsg = error.response.data?.errorMessage || 
                        error.response.data?.message ||
                        error.response.data ||
                        'Unknown error';

        // Check if error is captcha-related (retryable)
        const errorStr = typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg);
        const isRetryable =
          errorStr.includes('reCAPTCHA') ||
          errorStr.includes('Cloudflare') ||
          errorStr.includes('güvenlik doğrulaması') ||
          errorStr.includes('kontenjan dolmuştur') ||
          errorStr.includes('doğrulama');

        return {
          success: false,
          retryable: isRetryable,
          error: errorStr || error.message,
        };
      }

      return {
        success: false,
        retryable: true,
        error: error.message,
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private formatDuration(ms: number): string {
    const seconds = (ms / 1000).toFixed(2);
    return `${seconds}s`;
  }
}
