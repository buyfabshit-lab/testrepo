# Outlaw Harley Friend Finder

A one-file board for growing a Harley / outlaw-biker Instagram page by hand:
find active riders in the hashtag feeds, score how likely they are to follow
back, track every outreach, and stay under safe daily action limits.

It does **not** automate Instagram. No auto-follow, no scraping, no login.
Instagram bans for that, and bought or botted followers kill reach. The board
makes the manual work fast and targeted instead.

## Run it

Open `friend-finder/index.html` in a browser. Nothing to install, no backend.
Your data is saved in that browser's local storage. When the same page is
published as a claude.ai artifact it also syncs the crew list to your account,
so phone and desktop share one list.

## Tabs

| Tab | What it does |
|---|---|
| **Find** | The four-step route (open a tag's Recent feed, work the commenters, score, log). A 7-sign scorecard with a go / maybe / pass verdict. Hashtag routes in four tiers (big, mid, culture, local from your city and state) with one-tap links to Instagram, plus a 30-tag caption set builder with presets and a copy button. Keyword search deep link. |
| **Crew** | Pipeline funnel (Found, Engaged, Followed, Followed back, In DMs, Crew, Dropped) with follow-back rate. A follow-back check that surfaces riders you followed 7+ days ago with no follow back. Searchable table with inline stage, notes and a two-step remove. Copy the list as CSV. |
| **Daily ride** | Counters for follows, likes, comments, DMs and unfollows against editable daily limits, a daily route checklist, and a 7-day follows strip. Counts roll over at midnight. |
| **Playbook** | Content pillars, posting rhythm, comment and DM scripts (copy buttons), crew tactics, and what gets accounts restricted. |

## Defaults worth knowing

- Daily limits ship conservative for an account older than 90 days
  (60 follows, 150 likes, 25 comments, 12 DMs, 40 unfollows). Halve them for a
  new account. They are editable on the Daily ride tab.
- A rider scoring 4 or more of 7 signs is a "go". Setting a rider's stage to
  Followed adds one to today's follow count; marking an unfollow from the
  follow-back check adds one to unfollows.
- The follow-back check waits 7 days. "Keep" snoozes a rider another 7 days.

## Files

- `index.html` is the whole app: markup, styles and script. No build step.
