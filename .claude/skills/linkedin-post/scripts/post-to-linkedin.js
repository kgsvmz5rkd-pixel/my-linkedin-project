#!/usr/bin/env node
/**
 * Publish a post to LinkedIn using a previously saved session.
 *
 * Run save-linkedin-session.js once first to create the session file.
 *
 * Usage:
 *   node scripts/post-to-linkedin.js --file draft.md
 *   node scripts/post-to-linkedin.js --text "Hello world"
 *   node scripts/post-to-linkedin.js --file draft.md --dry-run --headed
 *
 * Flags:
 *   --file <path>   Read post content from a file (preferred for long posts).
 *   --text <str>    Inline post content.
 *   --dry-run       Fill the composer and screenshot, but DO NOT publish.
 *   --headed        Run with a visible browser window (useful for debugging).
 *
 * Env:
 *   LINKEDIN_SESSION_PATH  Override where the session is read from.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const MAX_CHARS = 3000;

function parseArgs(argv) {
  const args = { file: null, text: null, dryRun: false, headless: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') args.file = argv[++i];
    else if (a === '--text') args.text = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--headed') args.headless = false;
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

const SESSION_PATH =
  process.env.LINKEDIN_SESSION_PATH ||
  path.join(__dirname, '..', '.linkedin-session.json');

async function typeWithLineBreaks(page, text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) await page.keyboard.press('Enter'); // Enter = newline in the editor
    if (lines[i]) await page.keyboard.type(lines[i]);
  }
}

(async () => {
  const args = parseArgs(process.argv);

  let content = args.text;
  if (!content && args.file) content = fs.readFileSync(args.file, 'utf8');
  if (!content || !content.trim()) {
    console.error('No post content. Pass --file <path> or --text "<content>".');
    process.exit(1);
  }
  content = content.trim();

  if (content.length > MAX_CHARS) {
    console.error(
      `Post is ${content.length} chars, over LinkedIn's ${MAX_CHARS} limit. Shorten it.`
    );
    process.exit(1);
  }

  if (!fs.existsSync(SESSION_PATH)) {
    console.error(
      `No saved session at ${SESSION_PATH}.\nRun: node scripts/save-linkedin-session.js`
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: args.headless });
  const context = await browser.newContext({ storageState: SESSION_PATH });
  const page = await context.newPage();

  try {
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
    });

    if (page.url().includes('/login') || page.url().includes('/checkpoint')) {
      console.error(
        'Session expired or invalid. Re-run: node scripts/save-linkedin-session.js'
      );
      await browser.close();
      process.exit(2);
    }

    // Open the composer.
    await page
      .getByRole('button', { name: /start a post/i })
      .first()
      .click({ timeout: 30000 });

    // The post editor (contenteditable with an accessible name).
    const editor = page.getByRole('textbox', {
      name: /text editor for creating content/i,
    });
    await editor.waitFor({ timeout: 30000 });
    await editor.click();

    await typeWithLineBreaks(page, content);

    if (args.dryRun) {
      const shot = path.join(__dirname, '..', 'dry-run-preview.png');
      await page.screenshot({ path: shot, fullPage: false });
      console.log(`Dry run: preview saved to ${shot}. Nothing was published.`);
      await browser.close();
      return;
    }

    // Publish. The Post button lives inside the share dialog.
    const dialog = page.getByRole('dialog');
    const postButton = dialog.getByRole('button', { name: /^post$/i });
    await postButton.waitFor({ timeout: 15000 });
    await postButton.click();

    // Give LinkedIn a moment to submit and dismiss the dialog.
    await page.waitForTimeout(6000);
    console.log('Posted to LinkedIn.');
  } catch (err) {
    const shot = path.join(__dirname, '..', 'error-screenshot.png');
    try {
      await page.screenshot({ path: shot, fullPage: false });
      console.error(`Error: ${err.message}\nScreenshot saved to ${shot}`);
    } catch {
      console.error(`Error: ${err.message}`);
    }
    await browser.close();
    process.exit(1);
  }

  await browser.close();
})();
