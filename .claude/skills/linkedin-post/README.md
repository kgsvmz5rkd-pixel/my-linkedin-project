# linkedin-post skill

A Claude Code skill that researches a topic (web + Reddit), drafts a LinkedIn
post in your voice, and (after you approve) publishes it via Playwright.

## Getting started on your computer

Publishing needs a browser logged into your LinkedIn, so run this on your own
machine (not a cloud session). Do this once:

```bash
git clone <this repo> && cd <repo>/.claude/skills/linkedin-post
npm install
npx playwright install chromium
$EDITOR reference/voice-profile.md          # fill in your story + proof points
node scripts/save-linkedin-session.js       # browser opens; log into LinkedIn
```

Then, any time you want a post, just tell Claude a topic. It drafts, you
review and approve, it publishes. That's it.

## How it works

1. You give Claude a topic (or invoke the skill).
2. Claude researches: authoritative web publications and references first, then
   Reddit (via `scripts/reddit-research.js`) for real-world sentiment.
3. Claude drafts a post using `reference/voice-profile.md` (your tone, story,
   proof points).
4. Claude shows the draft + sources and waits for your approval.
5. On approval, a Playwright script publishes using a saved login session.

## One-time setup

```bash
cd .claude/skills/linkedin-post
npm install
npx playwright install chromium

# Fill in your voice so posts sound like you:
$EDITOR reference/voice-profile.md

# Save a LinkedIn login session (opens a browser; log in manually):
node scripts/save-linkedin-session.js
```

## Posting

The skill drives this for you, but manually it's:

```bash
# Preview without publishing:
node scripts/post-to-linkedin.js --file draft.md --dry-run --headed

# Publish:
node scripts/post-to-linkedin.js --file draft.md
```

## Reddit research

```bash
node scripts/reddit-research.js "your topic" --limit 6 --comments 3
# narrow it: --subreddit leadership --time month
```

Uses Reddit's public JSON endpoints (no auth). Reddit is a secondary source;
lead with web publications. Note: in Claude Code on the web, reddit.com is
usually not in the network egress allowlist, so this step works best run
locally (or add reddit.com to the environment's allowlist). Requires Node 18+.

## Security

- No passwords are stored. `save-linkedin-session.js` saves a browser session
  (`.linkedin-session.json`) which is gitignored. Treat it like a password —
  anyone with it can post as you.
- The skill never publishes without your explicit approval.
