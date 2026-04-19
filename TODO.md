# TODO

Things we noted as we went but didn't implement immediately.
Organized by priority and phase.

## Phase 04.6 — Prompt endpoint detection

Add the "~12 prompts sent / 2,060 total requests" contrast to the report.

**Why**: currently the hero shows only the total request count. The viral contrast between what the user actively typed vs what the browser sent in the background is missing.

**How**:
- Add `isPromptEndpoint: true|false` field to `data/endpoints.json`
- Maintain a curated list of known inference endpoints per vendor:
  - OpenAI ChatGPT: `POST chatgpt.com/backend-api/conversation`
  - OpenAI API: `POST api.openai.com/v1/chat/completions`
  - Anthropic Claude web: `POST claude.ai/api/organizations/*/chat_conversations/*/completion`
  - Anthropic API: `POST api.anthropic.com/v1/messages`
  - Gemini web: `POST gemini.google.com/_/BardChatUi/data/*/StreamGenerate`
  - Mistral Le Chat: `POST chat.mistral.ai/api/chat`
  - Perplexity: `POST www.perplexity.ai/rest/sse/perplexity_ask`
- Count hits on these endpoints separately in `counters.promptsTotal` and `counters.promptsToday`
- Display as "You probably sent ~{N} prompts" in the report hero, next to "{M} requests" total
- Still respects metadata-only contract — we match pathname only, never read body/headers

## Phase 04.7 — Per-country punchlines

Current `mapHeadline.usDominant` pool assumes US geography (Atlantic, California, Silicon Valley references). Breaks for:
- US users (their data doesn't "cross the Atlantic")
- Users with dominant CN or FR traffic
- Non-US-dominant distributions

**Fix**:
- Restructure `punchlines.json`:
mapHeadline.en.dominantByCountry = {
US: [...US-specific lines...],
CN: [...Chinese-specific lines...],
FR: [...France-specific lines...]
}
- Lower threshold from 80% to 70% for picking a dominant pool
- Add US-specific variants that DON'T mention Atlantic/California for US users
- Revisit after collecting 4-5 days of multi-country real data

## Phase 05 — Full PDF report (long format)

A downloadable 4-page A4 PDF with detailed breakdown, for users who click "Full report →":
- Page 1: cover reproducing the LinkedIn badge for brand consistency
- Page 2: detailed charts (per-day, per-vendor, per-category)
- Page 3: honest methodology + disclaimers
- Page 4: Symbiont / My Insights manifesto

Base design: adapt from v2 or v3 Harper's-style magazine editorial mockups we produced earlier.

## Phase 06 — Landing page + Chrome Web Store

- Landing at `overyourshoulder.ch` (domain purchased at Infomaniak)
  - Static HTML+CSS, ≤200KB, mobile-responsive
  - Editorial tone, same palette and typography as extension
  - OpenGraph meta (og:image 1200×630 on brand)
  - Zero analytics, zero cookies
  - Sections: hero + install CTA, report preview, 3-step explanation, trust (Swiss flag + GitHub + privacy claim), brief FAQ, footer
- Chrome Web Store submission:
  - Need 5 screenshots 1280×800
  - Privacy policy page (can be subpage of landing)
  - Extension description

## Smaller polish items

- **OYS.png source**: currently shipped in `/icons/` but not used at runtime. Could be moved to `/reference/` or removed from the shipped build to save ~160KB
- **earliestEventKey fallback**: after 30 days of continuous use, the rotation could prune all early day-keys. Need to store explicit `install_date` in `chrome.storage.local` at first launch rather than infer it from event keys
- **First-paint flicker**: on narrow viewports, the badge appears briefly at full 600px for ~1 frame before the scale transform applies. Minor, address if it becomes distracting
- **Variable Fraunces opsz axis preserved**: done in 04.5.1 via the variable WOFF2 files. No follow-up needed unless rendering drifts.
- **pour test: variable Fraunces WOFF2 axes**: confirm in browser devtools whether `opsz` 144 actually shows a different glyph than opsz 12 for the hero number. If identical, our variable file may not include the opsz axis.

## Done (for reference)

- Phase 01 — MV3 scaffold, manifest, background worker, popup
- Phase 02 — webRequest interception, observational metadata only
- Phase 03 — categorization, scoring, 27 endpoints, 4-factor score 0-100
- Phase 04 — LinkedIn-ready report, punchlines library, popup redesign
- Phase 04.5 / 04.5.1 — icon, pause visuals, Share/Download buttons, local fonts, responsive scaling, export sizing parity