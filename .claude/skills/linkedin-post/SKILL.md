---
name: linkedin-post
description: >-
  Research a topic on the web and Reddit, draft a LinkedIn post in the user's
  personal tone of voice (using their story and proof points), and publish it
  live to LinkedIn via a Playwright browser script after the user approves.
  Use when the user wants to research a topic and turn it into a LinkedIn post,
  write a LinkedIn post in their voice, or post to LinkedIn.
---

# LinkedIn research → draft → post

End-to-end workflow: take a topic, research it, write a post that sounds like the
user, get explicit approval, then publish to LinkedIn with a Playwright script
that reuses a saved login session.

## Hard rules

- **Never publish without explicit approval.** Always show the final draft and
  wait for the user to say go before running the posting script. "Draft then
  approve" is the default and is not optional.
- **Never invent facts about the user.** Personal story, achievements, numbers,
  and proof points come only from `reference/voice-profile.md`. If the profile
  is empty or missing a needed detail, ask the user — do not make it up.
- **Cite what research turned up** so the user can verify before posting.
- The session file (`.linkedin-session.json`) holds live auth cookies. It is
  gitignored. Never commit it, print its contents, or paste it anywhere.

## Step 1 — Get the topic and read the voice profile

1. Confirm the topic/angle with the user if it isn't already clear.
2. Read `reference/voice-profile.md` (path relative to this skill). This is the
   source of truth for tone, personal story, proof points, formatting habits,
   and topics to avoid.
3. If the profile still contains template placeholders (e.g. `<FILL IN>`), tell
   the user it needs to be filled in first, and offer to help draft it from
   anything they paste.

## Step 2 — Research

Gather current, concrete material. **Priority order matters:**

**Web publications and references come first.** Use `WebSearch` and `WebFetch`
to find recent, credible sources — reputable publications, research reports,
official data, and named references. These are the backbone of the post and
what gives it authority. Pull the specific stats, quotes, and findings, and
keep the source URLs.

**Reddit comes second**, as a supporting layer for real-world sentiment, pain
points, and the phrasing people actually use. Note: reddit.com is blocked to the
web crawler, so do NOT rely on `WebFetch`/`WebSearch` for it. Instead run the
bundled script, which uses Reddit's public JSON endpoints:

```bash
node scripts/reddit-research.js "<topic>" --limit 6 --comments 3
# optionally narrow: --subreddit <name> --time month
```

Use Reddit to add color and counterpoints, not as the primary evidence base.

Collect 3–6 concrete takeaways: stats, quotes, tensions, fresh angles, with web
publications leading and Reddit sentiment supporting. Keep a short source list
(title + URL) to show the user. Prefer specific, recent, verifiable points over
generic claims.

## Step 3 — Draft in the user's voice

Write a LinkedIn post that:

- Opens with a strong hook (first ~2 lines show before "...see more").
- Weaves the **research takeaways** together with the user's **personal story
  and proof points** from the voice profile — the post should sound like a
  person with a point of view, not a summary of search results.
- Matches the tone, sentence length, emoji/hashtag habits, and formatting in the
  voice profile.
- Stays under LinkedIn's 3,000-character limit (aim 1,200–1,800 for reach).
- Ends with a clear takeaway or a question that invites comments.
- Avoids anything in the profile's "do not say / avoid" list.

Show the user:
1. The draft post (exactly as it will appear).
2. The character count.
3. The research sources used.

## Step 4 — Get approval

Ask the user to approve, edit, or reject. Iterate on the draft until they
explicitly approve. **Do not proceed to Step 5 without a clear yes.**

Optionally, run a dry run first to preview in-browser without publishing:

```bash
node scripts/post-to-linkedin.js --file draft.md --dry-run --headed
```

This fills the composer and saves `dry-run-preview.png` but does not click Post.

## Step 5 — Publish

Prerequisite (one time): the user must have saved a login session. If
`.linkedin-session.json` does not exist, have them run:

```bash
node scripts/save-linkedin-session.js
```

This opens a real browser; the user logs in (including any 2FA), and the session
is saved locally. No passwords are ever stored by this skill.

To publish the approved post, write the final text to `draft.md`, then run:

```bash
node scripts/post-to-linkedin.js --file draft.md
```

The script loads the saved session, opens the composer, types the post
(preserving line breaks), and clicks Post. If it reports the session expired,
have the user re-run `save-linkedin-session.js` and try again.

### Images and link previews

- To attach a custom image, pass `--image <path>` (e.g.
  `assets/test-image.png`). A bundled placeholder image lives in `assets/`.
- When the post text contains a URL, LinkedIn auto-generates a link preview
  using the website's own image. The script removes that preview, and
  attaching an image replaces it entirely, so the user's chosen image is shown
  instead of the URL's image. The URLs remain as plain clickable links in the
  body. Use `--keep-preview` to opt out of removal.
- Always offer a `--dry-run --headed` first so the user can visually confirm
  the image is theirs (not the website's) before publishing.

After posting, confirm success to the user and clean up `draft.md` if desired.

## Setup notes

- Install dependencies once in this skill directory: `npm install` then
  `npx playwright install chromium`.
- Override the session location with `LINKEDIN_SESSION_PATH` if needed.
- Selectors target LinkedIn's accessibility roles (Start a post / Text editor /
  Post). If LinkedIn changes its UI and a selector breaks, run with `--headed`
  to watch, and update the selectors in `scripts/post-to-linkedin.js`.
