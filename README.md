# VisaCheckerService

`VisaCheckerService` is a NestJS service that monitors visa appointment dates from a specified API and sends notifications through Telegram whenever new dates are available. It utilizes caching to avoid duplicate notifications for the same date.

## Features

- Fetches visa appointment dates from an external API.
- Sends Telegram notifications when new dates are available.
- Caches dates to prevent redundant notifications.
- Uses environment variables for configuration.

## Requirements

- Node.js (>= 16.x)
- NestJS Framework
- Environment variables:
  - `CHAT_ID`: Your Telegram chat ID.
  - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token.

## Installation

1. Clone the repository:

```bash
git clone https://github.com/your-repository/visa-checker-service.git
cd visa-checker-service
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:
   Create a .env file in the root of the project and add the following:

```bash
CHAT_ID=your_telegram_chat_id
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

## Usage

1. Start the NestJS application:

```bash
npm run start
```

2. The service will periodically check for new visa appointment dates and send Telegram notifications if new dates are found.

## How It Works

1. Fetching Visa Dates:
   The service sends a POST request to the API endpoint https://appointment.as-visa.com/Macaristan/TarihGetir with the required payload to fetch available visa dates.
2. Caching:
   Dates are cached using node-cache with a TTL of 24 hours to avoid duplicate notifications for the same date.
3. Notification via Telegram:
   When new dates are detected, a message is sent to a specified Telegram chat using the Telegram Bot API.

## Dependencies

- **[NestJS](https://nestjs.com/)**: A progressive Node.js framework.
- **[Axios](https://axios-http.com/)**: For HTTP requests.
- **[Node-Cache](https://www.npmjs.com/package/node-cache)**: For in-memory caching.
- **[dotenv](https://www.npmjs.com/package/dotenv)**: For managing environment variables.

## Example Output

When a new visa date is detected, a Telegram notification is sent with a message similar to:

```bash
The new application date has arrived! Date: 2025-01-15
```
