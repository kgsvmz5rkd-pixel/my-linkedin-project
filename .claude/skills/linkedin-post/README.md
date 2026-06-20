# linkedin-post skill

A Claude Code skill that researches a topic (web + Reddit), drafts a LinkedIn
post in your voice, and — after you approve — publishes it via Playwright.

## How it works

1. You give Claude a topic (or invoke the skill).
2. Claude researches with web search + Reddit.
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

## Security

- No passwords are stored. `save-linkedin-session.js` saves a browser session
  (`.linkedin-session.json`) which is gitignored. Treat it like a password —
  anyone with it can post as you.
- The skill never publishes without your explicit approval.
