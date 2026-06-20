#!/usr/bin/env node
/**
 * Save a LinkedIn login session for reuse by post-to-linkedin.js.
 *
 * Opens a real (headed) Chromium window. Log in manually — including any 2FA or
 * security checkpoints. Once you reach your LinkedIn feed, the session
 * (cookies + storage) is written to a local file. No passwords are stored by
 * this script; only the resulting session state.
 *
 * Usage:
 *   node scripts/save-linkedin-session.js
 *
 * Env:
 *   LINKEDIN_SESSION_PATH  Override where the session is saved.
 */
const { chromium } = require('playwright');
const path = require('path');

const SESSION_PATH =
  process.env.LINKEDIN_SESSION_PATH ||
  path.join(__dirname, '..', '.linkedin-session.json');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.linkedin.com/login');

  console.log('\n=== Log in to LinkedIn in the browser window that just opened. ===');
  console.log('Complete any 2FA / security checks.');
  console.log('Waiting (up to 5 min) until you reach your feed...\n');

  // Resolves once login lands on the feed.
  await page.waitForURL('**/feed/**', { timeout: 5 * 60 * 1000 });

  await context.storageState({ path: SESSION_PATH });
  console.log(`\nSession saved to ${SESSION_PATH}`);
  console.log('You can now run: node scripts/post-to-linkedin.js --file draft.md');

  await browser.close();
})().catch((err) => {
  console.error('Failed to save session:', err.message);
  process.exit(1);
});
