Create two files at the project root.

=== FILE 1: README.md ===

```markdown
# Over Your Shoulder

A free Chrome extension that shows you where your AI data goes.

## What it does

Over Your Shoulder observes your browser's outbound traffic to known AI services (ChatGPT, Claude, Gemini, Mistral, DeepSeek, Perplexity, and others). It produces two things:

- **A shareable badge** — a single image summarizing your exposure score, countries touched, and vendors contacted. Downloadable as PNG.
- **A full PDF report** — eight pages breaking down your score across four factors (volume, categories, geography, continuity), with a map, vendor breakdown, hourly rhythm, and the legal context for every destination.

All analysis happens locally in your browser. Nothing leaves your device.

## Privacy

OYS uses Chrome's webRequest API in observation mode only. It records five fields of metadata per request:

- Timestamp
- Destination hostname
- Destination path (truncated to 50 characters)
- Tab identifier
- Source site

It does NOT record:

- Request bodies
- Response bodies
- Authorization headers
- Cookies
- Full URLs with query parameters
- IP addresses

All data stays in `chrome.storage.local`. The extension never connects to any external server. Data is rotated after 30 days.

See [overyourshoulder.ch/privacy](https://overyourshoulder.ch/privacy) for the full privacy policy.

## Installation

Install from the Chrome Web Store: [link coming soon]

Or load unpacked for development:

1. Clone this repo
2. Open `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select this directory

## Project structure

```
/manifest.json       MV3 manifest
/background.js       Service worker, webRequest listener
/popup/              Extension popup UI
/report/             Badge (LinkedIn-shareable) + full PDF report
/lib/                Scoring, country detection, shared helpers
/data/               Endpoints table, punchlines, source categories
/icons/              Extension icons
```

## Development

Requires Chrome or Edge (MV3-compatible browser).

No build step — the extension loads directly from source.

## License

MIT. See [LICENSE](./LICENSE).

## Credits

Over Your Shoulder is a project by [My Insights](https://myinsights.ch), based in Switzerland.

Contact: contact@overyourshoulder.ch
```

=== FILE 2: LICENSE ===

Use the standard MIT license text, with:
- Copyright year: 2026
- Copyright holder: My Insights

Standard MIT template:

```
MIT License

Copyright (c) 2026 My Insights

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

After creating both files, commit and push:

git add README.md LICENSE
git commit -m "docs: add README and MIT license ahead of making repo public"
git push