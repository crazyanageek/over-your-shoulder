# Phase 05 — Editorial Reference

**OYS Full PDF Report — 8 pages A4 portrait**

This document is the single source of truth for all editorial content of the full PDF report.
Claude Code will reference this document during phases 05.1, 05.2, 05.3, 05.4.

---

## GLOBAL CONSTRAINTS

**Format**: A4 portrait, 8 pages, 210mm × 297mm.
**Language**: English. French translation planned for later.
**Typography**: Fraunces (serif, titles + big numbers), Inter (sans-serif, body + labels), JetBrains Mono (data + code-like values).
**Palette**: same as LinkedIn badge — `--bg #FAFAF7`, `--ink #0E0E0D`, `--alarm #B91C1C`, `--warn #E28413`, `--make-volume #2B2B2A`, `--make-cat #BFA57A`, `--make-geo #B91C1C`, `--make-cont #3E5C66`.
**Tone**: journalist-informed, lightly ironic on titles and intros, neutral-factual on methodology content. Never marketing-speak, never academic.
**Links**: external URLs styled as discreet underline, no colored blue. Must be clickable in the PDF.

---

## TOKEN SYSTEM

All tokens are dynamic values computed from `chrome.storage.local`. Full list at the end of this document.

---

## PAGE 1 — COVER

**Status**: structure defined, detailed rendering to be specified in phase 05.1

**Content**:
- Large reprise of the LinkedIn badge visual
- Title in Fraunces: *Over Your Shoulder*
- Subtitle: *Your personal data exposure report*
- Hero number dominant, centered
- Date of generation
- Mini table of contents (bottom of page, 8 entries — titles of pages 2-8 with page numbers)

**Mini TOC entries** (to be finalized at page 1 rendering):
1. What was overlooked today
2. The numbers behind the number
3. Understanding the score
4. What this report sees, and what it does not
5. The rules that follow your data
6. A short glossary
7. And now what?

Total entries: 7 (pages 2 through 8).

---

## PAGE 2 — *What was overlooked today*

**Tone**: lightly ironic title, neutral-narrative body. 280-350 words.

**Text with dynamic tokens**:

> Here is what your browser did today.
>
> It sent its first request to an AI service at {firstTimeToday}, and its last at {lastTimeToday}. In between, you used {vendorList}. Every time you opened a conversation, scrolled back through a previous one, or left a tab sitting quietly in the background, your browser kept sending messages. {totalRequestsToday} of them.
>
> Not all of these messages were necessary. A chat interface like ChatGPT or Claude streams its answer word by word, which means hundreds of requests per response. It also sends telemetry about your scrolling, idle time, and which model you are using. A live conversation, even a short one, generates a lot of traffic. What is harder to justify is the activity when you are not actively chatting — background sync, session pings, analytics beacons, suggestions you did not ask for. Those happen whether your tab is in focus or not. Over the course of a day, they add up.
>
> Physically, where did those messages go? {cityBreakdown}. {countrySummary}
>
> You were actively engaged with AI tools for about {minutesActive} minutes today. That is the time you spent typing, waiting, reading answers. Your browser, during those same {minutesActive} minutes, was sending requests non-stop. One every {secondsPerRequest} seconds, on average. Some seconds it sent several.
>
> The next pages explain what this volume means, where these numbers come from, and what they do not show.

**Tokens for page 2**:

| Token | Computation |
|---|---|
| `{firstTimeToday}` | First event timestamp of today, formatted "8:47 AM" |
| `{lastTimeToday}` | Last event timestamp of today, formatted "3:12 PM" |
| `{vendorList}` | List of vendors in English grammar: 1 = "ChatGPT"; 2 = "ChatGPT and Claude"; 3+ = "ChatGPT, Claude, and Perplexity" |
| `{totalRequestsToday}` | Counter |
| `{cityBreakdown}` | Dynamic prose based on `counters.byHost` — see template below |
| `{countrySummary}` | Dynamic sentence based on `userCountry` + dominant country — see template below |
| `{minutesActive}` | From `computeExposureStats()` |
| `{secondsPerRequest}` | From `computeExposureStats()` |

**Template for `{cityBreakdown}`**:

For each top-5 city touched, generate a prose sentence using the anecdotal table:
- San Francisco → *"where OpenAI's main infrastructure lives"*
- New York → *"routed through Cloudflare's east coast edge network"*
- Paris → *"where Mistral hosts its servers"*
- Beijing → *"home to DeepSeek's infrastructure"*
- Amsterdam → *"through Microsoft Azure's European region"*
- (add more as needed)

Example outputs:
- Mono-city: *"Most of them landed in San Francisco, where OpenAI's main infrastructure lives."*
- Multi-city: *"About 2,000 of them landed in San Francisco, home to OpenAI's main infrastructure. 22 went to Paris, where Mistral hosts its servers. A few landed in Beijing, home to DeepSeek's infrastructure."*

**Template for `{countrySummary}`**:

Three branches based on user country + traffic:

- **Branch 1 (user in known country, traffic does NOT touch it)**:  
  *"Nothing stayed in {countryName}, where your browser was calling from."*
  - user = US → "the United States"
  - user = CH/FR/DE/GB/CN → country name

- **Branch 2 (user in known country, traffic DOES touch it)**:
  - 100% domestic: *"It all stayed within {countryName}. Rare, these days."*
  - Partial: *"Some of it stayed in {countryName}. Most of it did not."*

- **Branch 3 (user = "OTHER")**:  
  *"Your data left. You know where it went. We don't know where you are."*

---

## PAGE 3 — *The numbers behind the number*

**Tone**: journalistic-factual. Dense with data. 4 blocks (full mode) or 2 blocks (light mode).

**Mode threshold**: Full mode (4 blocks) requires ≥3 days observed **AND** ≥500 requests total. Otherwise light mode.

### Block 1 — Who received your data

Horizontal bar chart of vendors by volume. Mono-vendor case: full-width red bar with white centered text.

**Multi-vendor legend**:
> *"{vendorCount} services received your browser's requests today. {topVendorName} accounts for {topVendorShare}% of the total, followed by {secondVendorName} at {secondVendorShare}%."*

**Mono-vendor legend**:
> *"All your AI activity went to a single service. {vendorName} now holds a complete picture of what you asked about today."*

**Micro-list under legend**:
```
Total vendors contacted        {vendorCount}
Top vendor share               {topVendorShare}%
Top vs. second vendor ratio    {topToSecondRatio}x
```

### Block 2 — When your browser was talking

24-bar histogram (0-23h). Graphite bars, intensity by volume.

**Standard legend**:
> *"Your browser's busiest hour today was around {peakHour}, with {peakHourRequests} requests. It was quiet during {idleHours} hours of the day."*

**Concentrated-activity legend** (active <6h):
> *"Your browser's activity concentrated between {startHour} and {endHour}, with its busiest moment at {peakHour}."*

**Micro-list**:
```
First activity of the day      {firstActivityTime}
Last activity of the day       {lastActivityTime}
Peak hour                      {peakHour}
Peak hour volume               {peakHourRequests}
Quiet hours                    {idleHours}
Daytime / nighttime ratio      {dayNightRatio}
```

### Block 3 — How your score has moved

Score evolution curve over observed days, average line (dashed). Background zones: 0-30 subtle green, 30-60 neutral, 60-100 subtle pink.

**Standard legend**:
> *"Your score has moved between {minScore} and {maxScore} over the past {daysObserved} days. Today it sits at {todayScore}, {todayVsAvg}."*

**Stable legend** (variation <5 points):
> *"Your score has been remarkably stable over the past {daysObserved} days, hovering around {avgScore}. Today it sits at {todayScore}."*

**todayVsAvg values**:
- `>avgScore+5` → "notably above your average"
- `>avgScore+2` → "slightly above your average"
- `avgScore±2` → "right in line with your average"
- `<avgScore-2` → "slightly below your average"
- `<avgScore-5` → "notably below your average"

**Micro-list**:
```
Today's score                  {todayScore} / 100
Average over period            {avgScore}
Lowest recorded                {minScore}   on {minScoreDate}
Highest recorded               {maxScore}   on {maxScoreDate}
Trend                          {trendLabel}
```

### Block 4 — Everywhere your data went

Enriched map with all dots, all arcs. Origin dynamic by userCountry.

**Legend**:
> *"Your data reached {cityCount} cities across {countryCount} countries today. The farthest destination was {farthestCity}, at roughly {distanceKm} kilometers."*

**Two-column list under map**:
- Left column: top 10 cities with request counts and percentages
- Right column: all countries with counts and percentages

**Micro-list**:
```
Cities contacted                    {cityCount}
Countries contacted                 {countryCount}
Timezones crossed                   {timezoneCount}
Cross-border traffic                {percentCrossingBorders}%
Farthest destination                {farthestCity} ({distanceKm} km)
Total distance traveled             {totalDistanceKm} km
Countries outside your home         {foreignCountryCount}
```

### Light mode pedagogical note (replaces blocks 2 and 3)

Styling: 3px left border in ink-muted, light cream background, 1rem padding.

**Content**:
> *"Two more charts will appear on this page once your browser has had more conversations with AI services. A distribution of its activity across the hours of the day, and the evolution of your exposure score over time. This report will unlock the full view after 3 days and 500 requests captured. None of this data leaves your device — OpenAI, Google, and the others already have their copy."*

Tokens `{daysObserved}` and `{totalRequests}` dynamically injected for the user's current state.

---

## PAGE 4 — *Understanding the score*

**Tone**: neutral-factual, pedagogical. Mix of static explanations and dynamic user numbers integrated mid-sentence.

**Title**: *Understanding the score*

**Intro**:
> *"The score from 0 to 100 shown on the cover is not a verdict. It is a composite of four separate measurements, each reflecting a different kind of data exposure risk. A score of 45 can come from very different situations: heavy volume with narrow geography, or sparse volume sent to many jurisdictions. This page explains what each measurement means, how it is computed, and where your numbers fall."*

### Section 1 — Volume

> *"How many requests your browser sent to AI services. More is not always worse, but volume matters: each request carries metadata about what you are doing, even when its body contains no sensitive text. Your browser currently averages {avgDailyRequests} requests per day of observed activity. Volume caps at 30 points, reached gradually on a logarithmic scale — going from 100 to 1,000 requests per day adds fewer points than going from 10 to 100."*

**Micro-block**:
```
Your contribution     {volumeScore} / 30
Your daily average    {avgDailyRequests} requests
Percentile            {volumePercentile}% of observed days exceed this
```

### Section 2 — Categories

> *"Different kinds of sites generate different kinds of AI traffic. A request from your email client carries different information than a request from a code editor. This factor measures how many distinct sensitive categories your AI usage touches: email, code, documents, communications, finance, professional platforms, and others. So far you have touched {categoriesCount} of the seven tracked categories: {categoriesList}. Each category contributes 5 points, capped at 30."*

**Micro-block**:
```
Your contribution      {categoriesScore} / 30
Categories touched     {categoriesCount}: {categoriesList}
```

### Section 3 — Geography

**Three variants based on user country and traffic**:

**Variant A — multi-country with cross-border**:
> *"Where your data physically goes. A request that stays within your country falls under your local privacy laws. A request that crosses borders falls under the laws of the destination country — and, in some cases, under extraterritorial laws that extend beyond it. The US CLOUD Act, for example, allows US authorities to request data held by American companies regardless of where the user lives. {percentCrossingBorders}% of your requests today crossed a national border, with {topCountry} receiving the largest share at {topCountryShare}%. This factor caps at 25 points, weighted by the regulatory environment of each destination."*

**Variant B — 100% domestic (user = top country)**:
> *"Where your data physically goes. A request that stays within your country falls under your local privacy laws. Today, all of your AI traffic stayed within {userCountry}. This is rare: most users see most of their data routed abroad. Your Geography score reflects this concentration — you are exposed to a single jurisdiction rather than many. This factor caps at 25 points, weighted by the regulatory environment of each destination."*

**Variant C — 100% foreign, single country**:
> *"Where your data physically goes. A request that stays within your country falls under your local privacy laws. Today, 100% of your AI traffic went to a single foreign country: {topCountry}. No request stayed within {userCountry}. This factor caps at 25 points, weighted by the regulatory environment of each destination."*

**Micro-block**:
```
Your contribution           {geographyScore} / 25
Top destination country     {topCountry} ({topCountryShare}%)
Cross-border share          {crossBorderShare}%
```

### Section 4 — Continuity

**Two variants based on days observed**:

**Standard variant**:
> *"A single day of heavy exposure is different from weeks of steady exposure. This factor rewards — in the sense of raising the score — consistent daily usage over time. It reaches its maximum of 15 points after 7 days of regular activity. You have been observed for {daysObserved} days, currently on pace {continuityTrend}. The logic is that continuous profiling is harder to escape than a one-off event."*

**First-day variant**:
> *"A single day of heavy exposure is different from weeks of steady exposure. This factor rewards consistent daily usage over time. It reaches its maximum of 15 points after 7 days of regular activity. This is your first day of observed activity. Continuity will build up over the next six days. The logic is that continuous profiling is harder to escape than a one-off event."*

**continuityTrend values**:
- `daysObserved < 7` → "to reach the maximum in {X} more days"
- `daysObserved == 7` → "at full continuity score"
- `daysObserved > 7` → "well into consistent exposure territory"

**Micro-block**:
```
Your contribution     {continuityScore} / 15
Days observed         {daysObserved} of 7 needed for full score
Current pace          {continuityTrend}
```

### Closing

> *"These four factors add up to your total score, capped at 100. Each factor is independent: maxing out one does not affect the others. The score's purpose is not to pass judgment but to summarize exposure across dimensions that are otherwise easy to overlook."*

---

## PAGE 5 — *What this report sees, and what it does not*

**Tone**: neutral-factual, methodology-focused. Sections with tables.

**Title**: *What this report sees, and what it does not*

**Intro**:
> *"Every number in this report comes from your browser. None comes from the AI services themselves, from an external server, or from any remote database. The extension observes outbound requests as they leave your browser, records a few fields of metadata, and discards the rest. This page describes precisely what is recorded and what is not, so that the numbers above can be interpreted correctly."*

### Section 1 — What OYS records

Table:
```
Field                          Used for
───────────────────────────────────────────────────────────────
Timestamp                      When the request was sent
Destination hostname           Which service received the request
Destination path (truncated)   Category inference (email, code, etc.)
Tab identifier                 Counting requests per session
Source site                    The page that initiated the request
Endpoint type                  AI service vs. embedded monitoring
```

**Text under table**:
> *"These six fields are stored locally, in your browser, in the extension's own private storage. They are flushed to disk every 30 seconds and rotated out after 30 days. The service worker never connects to any external endpoint — neither to us, nor to any third party. AI platforms embed third-party monitoring services — Datadog, Sentry, analytics trackers — that receive data alongside the AI service itself. These are counted in the total request volume on page 2, but the geographic breakdown on page 3 shows only AI destinations to keep the map focused."*

### Section 2 — What OYS does not record

Table:
```
Not recorded                       Why not
───────────────────────────────────────────────────────────────
Request body                       Never read, never stored
Response body                      Never read, never stored
Authorization headers              Never read, never stored
Cookies                            Out of reach of the API used
Session identifiers                Not captured
File attachments                   Not inspected
Full URL with query parameters     Only truncated path is kept
IP addresses                       Not captured
```

**Text under table**:
> *"The extension uses Chrome's webRequest API in observation mode only. It cannot read encrypted request bodies, it does not decrypt network traffic, and it has no access to the actual content of your conversations. What a chat is about, what answer was received, whether a file was uploaded — all of this stays between you and the AI service. OYS never learns any of it."*

### Section 3 — How the numbers are computed

> *"The total request count is a literal count of observed events. It is not an estimate. The country attribution is derived from a local table that maps each AI service's known hosting location — for example, OpenAI's infrastructure is primarily in San Francisco, Mistral's in Paris, DeepSeek's in Beijing. This mapping is based on public information about where each company hosts its services. It is not based on your IP address, nor on the physical path your requests actually travel. If your traffic is routed through a VPN, or through a CDN edge node somewhere else, OYS still reports the declared hosting location, not the path. This is a deliberate choice: the question this report answers is where the AI service lives, not where the packets physically went."*

### Section 4 — Limits of this measurement

> *"This report captures the shape of your AI activity: how often, where, in what rhythm. It does not capture the substance: what you asked, what was answered, whether any of it was sensitive. A single thoughtful question about your medical history is invisible to OYS and would not raise your score. A thousand trivial queries about restaurant recommendations would. Volume is not a proxy for sensitivity. This is a deliberate limit of the tool — inspecting content would require reading your messages, which would be a worse privacy violation than anything this report could describe. OYS measures the surface of exposure, not its content. Interpret the numbers accordingly."*

---

## PAGE 6 — *The rules that follow your data*

**Tone**: neutral-factual, with external links to official sources.

**Title**: *The rules that follow your data*

**Intro**:
> *"Where your data goes determines which laws apply to it. A request sent from Zurich to San Francisco does not simply travel across the ocean — it crosses a legal boundary, and once it lands, it falls under the jurisdiction of the country that hosts it. This page outlines the main legal frameworks that shape what happens to your AI data once it leaves your browser. It is not legal advice. It is context, with links to primary sources."*

### Block 1 — The US CLOUD Act

> *"The [CLOUD Act][1] is an American law passed in 2018. It allows US authorities to compel American companies to hand over data they hold, regardless of where that data is physically stored. If OpenAI operates a data center in Ireland, the servers are in Ireland, but the company is American — and American authorities can require access. This is why {topDestinationShare}% of your traffic going to the United States is not only a geographic fact but a jurisdictional one. The law that can access this data is American, even if the data never sat on American soil."*

**[1]** https://www.justice.gov/criminal/cloud-act-resources

### Block 2 — The GDPR and Swiss equivalents

> *"In Europe, the [General Data Protection Regulation (GDPR)][2] applies to any processing of personal data of individuals located in the European Union. Switzerland has a closely aligned framework, the [revised Federal Act on Data Protection (nFADP)][3], in force since September 2023. Both laws consider the transfer of personal data to a third country — including to the United States — as a regulated operation. The consent framework is narrow, and the compliance burden rests on the service provider, not on the user. When you send a prompt to a US-based AI service, you are initiating a transfer that falls under these rules."*

**[2]** https://eur-lex.europa.eu/eli/reg/2016/679/oj
**[3]** URL to verify — Swiss Federal Office of Justice (nFADP official page)

### Block 3 — Schrems II and the invalidation of Privacy Shield

> *"In 2020, the [Court of Justice of the European Union ruled, in the case known as Schrems II][4], that the Privacy Shield agreement between the EU and the US was invalid. The court found that American surveillance laws provided insufficient protection for European data. The decision left most transfers of personal data to the US in a legal grey area, patched partially by a [successor agreement in 2023][5]. The underlying question remains unresolved: European data on American servers can, in principle, be accessed by American intelligence services under laws that would not pass muster in Europe."*

**[4]** URL to verify — curia.europa.eu, Case C-311/18
**[5]** URL to verify — European Commission, EU-US Data Privacy Framework

### Block 4 — China and the Cybersecurity Law

> *"Chinese AI services — DeepSeek, Kimi, Qwen, and others — operate under a different legal framework. The [Cybersecurity Law of 2017][6] and the [Data Security Law of 2021][7] require companies operating in China to store data of Chinese users domestically, and to cooperate with state authorities on request. Unlike in the US or the EU, there is no meaningful judicial review of such requests. For a European or Swiss user, sending a prompt to a Chinese AI service is a one-way transfer into a jurisdiction where the concept of data subject rights does not functionally exist. {percentToChina}% of your traffic today went to Chinese services. The data is unlikely to come back."*

**China variant B (percentToChina == 0)**:
> *"Chinese AI services — DeepSeek, Kimi, Qwen, and others — operate under a different legal framework. The [Cybersecurity Law of 2017][6] and the [Data Security Law of 2021][7] require companies operating in China to store data of Chinese users domestically, and to cooperate with state authorities on request. Unlike in the US or the EU, there is no meaningful judicial review of such requests. Your traffic today did not reach Chinese services, but this is a rule to keep in mind: some widely-used AI tools, especially newer entrants, are based in China. A single prompt sent there follows these rules."*

**[6]** URL to verify — Cyberspace Administration of China or National People's Congress
**[7]** URL to verify — Official Chinese government source

### Block 5 — Residency versus access

> *"Two questions are often confused: where is the data stored, and who can access it? A European data center operated by an American company does not, by itself, remove the data from American jurisdiction. Conversely, data stored in the United States but owned by a European company remains under European contractual obligations. For AI services, the question to ask is not only 'where are the servers?' but 'who owns the company that operates them, and under what law do they answer requests for data?' This report maps the first question. The second is yours to investigate."*

---

## PAGE 7 — *A short glossary*

**Tone**: descriptive, neutral. Two-column layout.

**Title**: *A short glossary*

**Intro**:
> *"The terms below appear throughout this report. Definitions are kept brief and specific to how OYS uses them."*

### Terms (alphabetical, 13 total)

**AI service** — Any platform or application that provides access to a large language model or similar AI capabilities, whether through a web interface, a desktop app, or an API. Examples in this report include ChatGPT, Claude, Gemini, Mistral, DeepSeek, and Perplexity.

**API (Application Programming Interface)** — A technical interface that allows software to communicate with an AI service directly, without a human-facing website. Requests made through an API have the same data exposure consequences as requests made through a web interface. OYS detects both.

**Category** — A type of site from which an AI request originates. OYS recognizes seven categories: email, code, documents, communications, finance, professional platforms, and other. The score's Categories factor rewards diversity of exposure across these types.

**Cross-border request** — A request whose destination country is different from the user's declared country. If the user is in Switzerland and the request goes to a US-hosted service, it counts as cross-border.

**Endpoint** — The specific network address a request is sent to. For an AI service, an endpoint is typically a URL on the service's servers, such as `api.openai.com/v1/chat/completions`. OYS identifies endpoints by their hostname and path.

**Exposure score** — The 0-to-100 score shown on the cover of this report. It is a composite of four factors — Volume, Categories, Geography, and Continuity — each measuring a different dimension of data exposure. See page 4 for the full breakdown.

**Hostname** — The domain portion of a URL, such as `chatgpt.com` or `api.anthropic.com`. OYS uses hostnames to identify which AI service received a request.

**Metadata** — Data about data. In the context of this report, metadata is information about a request — when it was sent, where it went, what category of site initiated it — but not the request's actual content. OYS only processes metadata, never content.

**Request** — A single network message sent from your browser to a server. A typical AI conversation generates hundreds of these: the interface loads, your message is sent, the response streams back word by word, the conversation is saved, telemetry is sent in the background. Each of these steps is one or more requests.

**Session** — A period of continuous AI activity. OYS counts a new session whenever you pause for more than five minutes. Sessions are used to compute exposure time: scattered activity across a day may count as two or three sessions rather than one continuous stretch.

**Streaming** — The technique AI services use to display a response as it is being generated, rather than waiting for the full answer to be ready. Each word or small chunk is sent separately, producing dozens or hundreds of requests per single response. Streaming makes the interface feel responsive, but it also means that a single question can generate far more network traffic than a traditional web form.

**Vendor** — The company that operates an AI service. OpenAI is the vendor behind ChatGPT; Anthropic behind Claude; Google behind Gemini. OYS maps hostnames to vendors to produce the vendor breakdown on page 3.

**Web interface** — An AI service accessed through a normal browser at a standard URL, such as `chatgpt.com` or `claude.ai`. OYS primarily observes web interfaces. Desktop apps and mobile apps are not captured by the extension.

---

## PAGE 8 — *And now what?*

**Tone**: pragmatic, lightly ironic intro, no marketing push.

**Title**: *And now what?*

**Intro**:
> *"Reading this report is not enough. Reading it and then forgetting about it is the default. Reading it and changing something — anything — is the exception. This page suggests three small directions, in increasing order of effort. None of them is required. All of them are practical."*

### Action 1 — Know what you're agreeing to

> *"Every AI service has retention and training policies buried somewhere in its terms of use. Most users never read them. But the difference between a service that deletes prompts after 30 days and one that uses them to train future models is substantial. Before sending your next conversation, spend five minutes finding out how long it will be kept and what will be done with it. The answer is often surprising — sometimes reassuring, sometimes not. OpenAI, Anthropic, Google, Mistral, and others all publish these policies. Look them up. Once. It takes less time than the conversation itself."*

### Action 2 — Diversify, or consolidate on purpose

> *"This report may show that a single service received most of your traffic today. That concentration has a cost: one company ends up with a complete picture of what you asked about. Two patterns are defensible. Either you diversify deliberately — different services for different types of questions, so no single one sees everything — or you consolidate on purpose, knowing which company you trust most and accepting that trade-off. Both are better than drifting into concentration by accident."*

### Action 3 — Consider where the service lives

> *"Not all AI services run on the same legal ground. European alternatives exist — Mistral in France, Aleph Alpha in Germany, and others — and they operate under EU data protection laws rather than under the US CLOUD Act or the Chinese Cybersecurity Law. Choosing them is not a moral statement; it is a jurisdictional choice. For certain categories of data — business, legal, health — it may matter. For others — casual questions, public information — it likely doesn't. Knowing the difference is the first step."*

### Closing note

> *"Over Your Shoulder is a tool for insight, not control. It tells you where your data goes. It does not stop it from going there. If the patterns shown in this report concern you, the right next step is to change your habits, not to install another extension. For organizations that want deeper visibility into AI-driven data flows — across teams, across tools — we are building [Symbiont](https://myinsights.ch)."*

### Footer

```
overyourshoulder.ch · contact@overyourshoulder.ch

© {year} [My Insights](https://myinsights.ch) · Lausanne, Switzerland
Report generated on {date} at {time}
```

---

## FULL TOKEN LIST

**Already computed (available via current storage)**:
- `{totalRequestsToday}`, `{firstTimeToday}`, `{lastTimeToday}`
- `{vendorList}` (from `counters.byVendor`)
- `{minutesActive}`, `{secondsPerRequest}` (from `computeExposureStats()`)
- `{vendorCount}`, `{topVendorName}`, `{topVendorShare}`, `{secondVendorName}`, `{secondVendorShare}`, `{topToSecondRatio}`, `{vendorName}`
- `{peakHour}`, `{peakHourRequests}`, `{idleHours}`, `{startHour}`, `{endHour}`, `{firstActivityTime}`, `{lastActivityTime}`, `{dayNightRatio}`
- `{todayScore}`, `{volumeScore}`, `{categoriesScore}`, `{geographyScore}`, `{continuityScore}`
- `{categoriesCount}`, `{categoriesList}`, `{avgDailyRequests}`, `{volumePercentile}`
- `{topCountry}`, `{topCountryShare}`, `{crossBorderShare}`, `{percentCrossingBorders}`, `{percentToChina}`, `{topDestinationShare}`
- `{cityCount}`, `{countryCount}`, `{foreignCountryCount}`, `{userCountry}`, `{countryName}`
- `{daysObserved}`, `{totalRequests}`
- `{date}`, `{time}`, `{year}`

**To be added to storage (phase 05.3)**:
- `oys_score_history` array: `[{date: "2026-04-19", score: 39, factors: {volume, categories, geography, continuity}}, ...]`

**New computations needed (phase 05.3)**:
- `{minScore}`, `{maxScore}`, `{avgScore}`, `{minScoreDate}`, `{maxScoreDate}`, `{trendLabel}`, `{todayVsAvg}`
- `{timezoneCount}`, `{farthestCity}`, `{distanceKm}`, `{totalDistanceKm}` — haversine formula, origin→destination × request count
- `{cityBreakdown}`, `{countrySummary}` — template selection + prose generation
- `{continuityTrend}`

---

## IMPLEMENTATION PHASES

**Phase 05.1 — Scaffold**
- Create `/report/full.html` with 8 A4 pages stacked vertically
- CSS with `@page`, `page-break-after`, A4 portrait dimensions
- Placeholder text for all content
- Deliverable: HTML page that can be Print-to-PDF from Chrome

**Phase 05.2 — Static content + simple tokens**
- Integrate all editorial text from this document
- Fill in simple tokens that are already computable
- Leave complex tokens as placeholders
- Verify all external links work
- Deliverable: PDF with complete content, partial dynamism

**Phase 05.3 — New computations + storage**
- Add `oys_score_history` storage
- Compute distances, timezones, trends, dates
- Implement `{cityBreakdown}`, `{countrySummary}` template engines
- All tokens now dynamically populated
- Deliverable: PDF with 100% dynamic content

**Phase 05.4 — Graphics**
- Test graphics in sandbox HTML (with Jon)
- Implement 4 charts: vendors, hourly, score evolution, enriched map
- Integrate into the PDF
- Deliverable: final complete PDF

---

END OF PHASE 05 EDITORIAL REFERENCE
