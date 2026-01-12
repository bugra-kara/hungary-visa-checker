# Hungary Visa Appointment Checker & Auto-Booker

Automatically checks for available Hungary visa appointment dates and books appointments when the target date becomes available.

## Features

- 🔄 **Automated Checking**: Checks for available visa dates every 15 seconds
- 🎯 **Target Date Booking**: Automatically attempts to book when target date (16/02/2026 10:45) is found
- 🤖 **Captcha Solving**: Automatically solves Turnstile and ReCaptcha V3 using Anti-Captcha
- 📦 **Token Queue System**: Maintains a pool of 5 pre-solved captcha tokens for instant booking
- 🚀 **Parallel Token Generation**: Creates 5 tokens simultaneously on startup for quick readiness
- 📱 **Telegram Notifications**: Sends notifications for new dates and booking results
- 💾 **Smart Caching**: Prevents duplicate notifications for the same date

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Anti-Captcha API key ([Get one here](https://anti-captcha.com))
- Telegram Bot Token and Chat ID ([Setup guide](https://core.telegram.org/bots))

## Installation

1. Clone the repository:
```bash
cd /Users/bugra/Desktop/visa-checker
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` file with your information:
```env
# Telegram Configuration
CHAT_ID=your_telegram_chat_id
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Anti-Captcha Configuration
ANTI_CAPTCHA_API_KEY=your_anticaptcha_api_key

# User Information
TC_KIMLIK_NO=12345678901
PASSPORT_NUMBER=U12345678
NAME=YOUR_NAME
SURNAME=YOUR_SURNAME
PHONE=905001234567
EMAIL=your.email@example.com
BIRTH_YEAR=1990

# Travel Information
TRAVEL_DATE=09/03/2026
TRAVEL_SUBJECT=Turist
```

## Usage

### Development Mode
```bash
npm run start:dev
```

### Production Mode
```bash
npm run build
npm run start:prod
```

## How It Works

### 1. Token Generation
- On startup, creates 5 Turnstile and 5 ReCaptcha tokens **in parallel**
- Maintains a continuous background process to keep token pool at 5
- When a token is used, immediately starts generating a new one

### 2. Date Checking
- Checks for available dates every 15 seconds
- Sends Telegram notification when new dates are found
- Caches notified dates to prevent duplicates (24-hour TTL)

### 3. Auto-Booking
- When target date `16/02/2026` at `10:45` is detected:
  1. Sends Telegram notification about finding the target date
  2. Waits for first token pair if not ready yet
  3. Attempts to book the appointment with retry logic (up to 10 attempts)
  4. Uses fresh token pair for each retry attempt
  5. Sends success/failure notification via Telegram

### 4. Token Queue System
```
┌─────────────────────────┐
│   Token Producers       │
│  (Background Workers)   │
└───────────┬─────────────┘
            │
            ├──> Turnstile Queue [Token1, Token2, Token3, Token4, Token5]
            │
            └──> ReCaptcha Queue [Token1, Token2, Token3, Token4, Token5]
                        │
                        ▼
                  ┌──────────────┐
                  │  Booking Bot │
                  └──────────────┘
```

## Configuration

### Target Date & Time
Edit `visa-checker.service.ts`:
```typescript
private readonly targetDate = '16/02/2026';  // DD/MM/YYYY
private readonly targetTime = '10:45';       // HH:MM
```

### Check Interval
Edit `app.service.ts`:
```typescript
@Cron('*/15 * * * * *')  // Every 15 seconds
```

### Token Queue Size
Edit `appointment.service.ts`:
```typescript
tokenQueueSize: 5,  // Number of tokens to keep in queue
```

## Monitoring

### Logs
The application provides detailed logging:
- `[Turnstile Producer]` - Turnstile token generation
- `[ReCaptcha Producer]` - ReCaptcha token generation
- `[Init]` - Initial parallel token generation
- `[AppointmentService]` - Booking attempts
- `[VisaCheckerService]` - Date checking

### Telegram Notifications
You'll receive notifications for:
- ✅ Bot startup confirmation
- 📅 New available dates
- 🎯 Target date found
- ✅ Successful booking
- ❌ Booking failures

## Troubleshooting

### "ERROR_NO_SLOT_AVAILABLE"
- Your Anti-Captcha account has no available workers
- Wait a few seconds or increase your maximum bid in Anti-Captcha settings

### "reCAPTCHA güvenlik doğrulaması başarısız"
- Token was rejected by the server
- System will automatically retry with a fresh token

### "Seçilen tarih için bireysel kontenjan dolmuştur"
- The time slot is fully booked
- System will continue trying with new tokens

### No Telegram notifications
- Check `CHAT_ID` and `TELEGRAM_BOT_TOKEN` in `.env`
- Ensure chat ID has the minus sign: `-1234567890`

## API Costs

**Anti-Captcha Pricing:**
- Turnstile: ~$2.00 per 1000 solves
- ReCaptcha V3: ~$1.50 per 1000 solves

**Estimated cost per booking attempt:**
- With retry logic (avg 3 attempts): ~$0.021

## Development

### Project Structure
```
src/
├── app.module.ts              # Main module
├── app.service.ts             # Cron scheduler
├── visa-checker.service.ts    # Date checking & booking coordinator
├── appointment.service.ts     # Token management & booking logic
└── main.ts                    # Application entry point
```

### Adding New Features
1. Create new service in `src/`
2. Add to `app.module.ts` providers
3. Inject into `visa-checker.service.ts` if needed

## License

UNLICENSED - Private use only

## Support

For issues or questions, check:
- [Anti-Captcha Documentation](https://anti-captcha.com/apidoc)
- [NestJS Documentation](https://docs.nestjs.com)

## Disclaimer

This tool is for educational purposes. Ensure compliance with the visa appointment website's terms of service.