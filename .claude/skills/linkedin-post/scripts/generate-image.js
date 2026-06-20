#!/usr/bin/env node
/**
 * Generate a clean, branded text/quote card image (PNG) — no external accounts
 * or paid APIs. Renders an HTML template with the bundled browser and
 * screenshots it, so you get nice typography for free.
 *
 * Usage:
 *   node scripts/generate-image.js --text "Your headline here"
 *   node scripts/generate-image.js --text "Big idea" --subtext "A supporting line" \
 *        --bg "#0A66C2" --fg "#FFFFFF" --out assets/my-card.png
 *
 * Flags:
 *   --text <str>     Main headline (required). Use \n for line breaks.
 *   --subtext <str>  Optional smaller line beneath the headline.
 *   --bg <color>     Background color (hex or CSS). Default #0A66C2 (LinkedIn blue).
 *   --fg <color>     Text color. Default #FFFFFF.
 *   --accent <color> Optional accent bar color above the headline.
 *   --out <path>     Output PNG path. Default assets/generated-card.png.
 *   --width <px>     Canvas width. Default 1200.
 *   --height <px>    Canvas height. Default 630 (LinkedIn 1.91:1).
 *
 * Then attach it with: post-to-linkedin.js --media <out>
 */
const { chromium } = require('playwright');
const path = require('path');

function parseArgs(argv) {
  const args = {
    text: null,
    subtext: null,
    bg: '#0A66C2',
    fg: '#FFFFFF',
    accent: null,
    out: path.join(__dirname, '..', 'assets', 'generated-card.png'),
    width: 1200,
    height: 630,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--text') args.text = argv[++i];
    else if (a === '--subtext') args.subtext = argv[++i];
    else if (a === '--bg') args.bg = argv[++i];
    else if (a === '--fg') args.fg = argv[++i];
    else if (a === '--accent') args.accent = argv[++i];
    else if (a === '--out') args.out = path.resolve(argv[++i]);
    else if (a === '--width') args.width = parseInt(argv[++i], 10);
    else if (a === '--height') args.height = parseInt(argv[++i], 10);
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Escape, then turn literal "\n" or real newlines into <br>.
function toHtml(str) {
  return escapeHtml(str).replace(/\\n|\n/g, '<br>');
}

(async () => {
  const args = parseArgs(process.argv);
  if (!args.text || !args.text.trim()) {
    console.error('Missing --text "Your headline".');
    process.exit(1);
  }

  const accentEl = args.accent
    ? `<div class="accent"></div>`
    : '';
  const subEl = args.subtext ? `<p>${toHtml(args.subtext)}</p>` : '';

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${args.width}px; height: ${args.height}px; }
    body {
      display: flex; flex-direction: column;
      justify-content: center; align-items: flex-start;
      background: ${args.bg}; color: ${args.fg};
      padding: 88px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
        'Helvetica Neue', Arial, sans-serif;
    }
    .accent {
      width: 96px; height: 12px; border-radius: 6px;
      background: ${args.accent || 'transparent'}; margin-bottom: 44px;
    }
    h1 {
      font-size: 72px; line-height: 1.08; font-weight: 800;
      letter-spacing: -1.5px; max-width: 100%;
    }
    p {
      margin-top: 32px; font-size: 36px; font-weight: 500;
      line-height: 1.3; opacity: 0.92;
    }
  </style></head><body>
    ${accentEl}
    <h1>${toHtml(args.text)}</h1>
    ${subEl}
  </body></html>`;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: args.width, height: args.height },
      deviceScaleFactor: 2, // crisp output
    });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.screenshot({ path: args.out });
    console.log(`Generated image: ${args.out}`);
  } catch (err) {
    console.error(`Error generating image: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
