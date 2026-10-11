#!/usr/bin/env node
/** Update Telegram's slash-command picker after a successful Worker release. */
import { syncBotCommands } from '../src/commandSync.js';

try {
  const changed = await syncBotCommands(process.env.TELEGRAM_BOT_TOKEN);
  console.log(changed ? 'Telegram bot command picker updated.' : 'Telegram bot command picker already up to date.');
} catch (error) {
  console.error('Telegram command registration failed:', error instanceof Error ? error.message : 'unknown');
  process.exitCode = 1;
}
