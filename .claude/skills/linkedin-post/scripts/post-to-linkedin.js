#!/usr/bin/env node
/**
 * Publish a post to LinkedIn using a previously saved session.
 *
 * Run save-linkedin-session.js once first to create the session file.
 *
 * Usage:
 *   node scripts/post-to-linkedin.js --file draft.md
 *   node scripts/post-to-linkedin.js --text "Hello world"
 *   node scripts/post-to-linkedin.js --text "test one" --image assets/test-image.png
 *   node scripts/post-to-linkedin.js --file draft.md --dry-run --headed
 *
 * Flags:
 *   --file <path>    Read post content from a file (preferred for long posts).
 *   --text <str>     Inline post content.
 *   --image <path>   Attach a custom image. This also REPLACES LinkedIn's
 *                    auto-generated link preview, so any URLs in the text show
 *                    as plain links and your image is used instead.
 *   --keep-preview   Do not try to remove LinkedIn's auto link preview.
 *   --dry-run        Fill the composer and screenshot, but DO NOT publish.
 *   --headed         Run with a visible browser window (useful for debugging).
 *
 * Env:
 *   LINKEDIN_SESSION_PATH  Override where the session is read from.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const MAX_CHARS = 3000;

function parseArgs(argv) {
  const args = {
    file: null,
    text: null,
    image: null,
    keepPreview: false,
    dryRun: false,
    headless: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') args.file = argv[++i];
    else if (a === '--text') args.text = argv[++i];
    else if (a === '--image') args.image = argv[++i];
    else if (a === '--keep-preview') args.keepPreview = true;
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

// Best-effort removal of the auto-generated link preview card.
async function removeLinkPreview(page) {
  const candidates = [
    page.getByRole('button', { name: /remove (link|article|media|preview)/i }),
    page.getByRole('button', { name: /^remove$/i }),
    page.getByRole('button', { name: /dismiss/i }),
  ];
  for (const c of candidates) {
    try {
      if ((await c.count()) > 0) {
        await c.first().click({ timeout: 3000 });
        return true;
      }
    } catch {
      // try next candidate
    }
  }
  return false;
}

// Attach a custom image. Adding media also makes LinkedIn drop the link preview.
async function attachImage(page, imagePath) {
  // Click the media/photo button so the file input is mounted.
  try {
    await page
      .getByRole('button', { name: /add a photo|add media|photo/i })
      .first()
      .click({ timeout: 8000 });
  } catch {
    // Some layouts mount the input without an explicit click.
  }

  // Set the file directly on the hidden input (most reliable approach).
  let input = page.locator('input[type="file"][accept*="image"]');
  if ((await input.count()) === 0) input = page.locator('input[type="file"]');
  await input.first().waitFor({ state: 'attached', timeout: 10000 });
  await input.first().setInputFiles(imagePath);

  // Step through the image editor's Next / Done buttons if they appear.
  for (const label of [/^next$/i, /^done$/i]) {
    const btn = page.getByRole('button', { name: label });
    try {
      await btn.waitFor({ timeout: 6000 });
      await btn.click();
    } catch {
      // not present in this flow
    }
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

  let imagePath = null;
  if (args.image) {
    imagePath = path.resolve(args.image);
    if (!fs.existsSync(imagePath)) {
      console.error(`Image not found: ${imagePath}`);
      process.exit(1);
    }
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

    // If there are URLs, LinkedIn renders a preview card after a moment.
    // Remove it (unless asked to keep it) so the website's image isn't used.
    const hasUrl = /https?:\/\/|www\./i.test(content);
    if (hasUrl && !args.keepPreview) {
      await page.waitForTimeout(3500); // let the preview load
      const removed = await removeLinkPreview(page);
      console.log(
        removed
          ? 'Removed auto link preview.'
          : 'No removable link preview found (image attach will also drop it).'
      );
    }

    // Attach the custom image. This is what gets shown instead of any URL image.
    if (imagePath) {
      await attachImage(page, imagePath);
      console.log(`Attached image: ${imagePath}`);
    }

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
    await page.waitForTimeout(8000);
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
