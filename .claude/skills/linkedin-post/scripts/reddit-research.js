#!/usr/bin/env node
/**
 * Search Reddit via its public JSON endpoints (no auth, no browser crawler).
 *
 * Reddit is a SECONDARY source for this skill. Lead with authoritative web
 * publications and references; use this for real-world sentiment, pain points,
 * and the phrasing people actually use.
 *
 * Usage:
 *   node scripts/reddit-research.js "your topic"
 *   node scripts/reddit-research.js "your topic" --limit 6 --comments 3
 *   node scripts/reddit-research.js "your topic" --subreddit leadership
 *   node scripts/reddit-research.js "your topic" --time month
 *
 * Flags:
 *   --limit N        Number of threads to return (default 6).
 *   --comments N     Top comments to pull per thread (default 3, 0 to skip).
 *   --subreddit S    Restrict search to r/S.
 *   --time T         hour|day|week|month|year|all (default year).
 *
 * Requires Node 18+ (uses global fetch).
 */

// A browser-like User-Agent works best against Reddit's public .json endpoints;
// generic library/script UAs are often rejected.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function parseArgs(argv) {
  const args = {
    query: null,
    limit: 6,
    comments: 3,
    subreddit: null,
    time: 'year',
  };
  const rest = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--comments') args.comments = parseInt(argv[++i], 10);
    else if (a === '--subreddit') args.subreddit = argv[++i];
    else if (a === '--time') args.time = argv[++i];
    else rest.push(a);
  }
  args.query = rest.join(' ').trim();
  return args;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        `HTTP 403 for ${url}\n` +
          'reddit.com may be blocked. If running in Claude Code on the web, ' +
          'reddit.com is likely not in the environment network allowlist — run ' +
          'this script locally, or add reddit.com to network egress settings.'
      );
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

function truncate(str, n) {
  if (!str) return '';
  const clean = str.replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n) + '…' : clean;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.query) {
    console.error('Usage: node scripts/reddit-research.js "your topic" [flags]');
    process.exit(1);
  }

  const base = args.subreddit
    ? `https://www.reddit.com/r/${encodeURIComponent(args.subreddit)}/search.json`
    : 'https://www.reddit.com/search.json';
  const params = new URLSearchParams({
    q: args.query,
    sort: 'relevance',
    t: args.time,
    limit: String(args.limit),
  });
  if (args.subreddit) params.set('restrict_sr', '1');

  let search;
  try {
    search = await getJson(`${base}?${params.toString()}`);
  } catch (err) {
    console.error(`Reddit search failed: ${err.message}`);
    process.exit(1);
  }

  const posts = (search?.data?.children || [])
    .map((c) => c.data)
    .filter(Boolean);

  if (posts.length === 0) {
    console.log(`No Reddit results for: ${args.query}`);
    return;
  }

  console.log(`Reddit results for: ${args.query}\n`);

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    console.log(`${i + 1}. ${p.title}`);
    console.log(`   r/${p.subreddit} · ${p.score} upvotes · ${p.num_comments} comments`);
    console.log(`   https://www.reddit.com${p.permalink}`);
    if (p.selftext) console.log(`   ${truncate(p.selftext, 300)}`);

    if (args.comments > 0) {
      try {
        const thread = await getJson(
          `https://www.reddit.com${p.permalink}.json?limit=${args.comments}&sort=top`
        );
        const comments = (thread?.[1]?.data?.children || [])
          .map((c) => c.data)
          .filter((d) => d && d.body && d.body !== '[deleted]')
          .slice(0, args.comments);
        for (const c of comments) {
          console.log(`     - (${c.score}) ${truncate(c.body, 240)}`);
        }
      } catch {
        // Comment fetch is best-effort; skip on failure.
      }
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
