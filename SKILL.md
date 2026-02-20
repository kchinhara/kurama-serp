---
name: kurama-serp
description: Zero-cost Google Ads SERP scraper. Uses a real Chromium browser via Playwright to scrape competitor ads from Google Search with precise geo-targeting. Outputs raw JSON, structured competitive data, and a markdown report with messaging pattern detection. No API keys, no per-scrape costs.
license: MIT
metadata:
  version: 1.0.0
  author: Kuda Chinhara
  url: https://agenticppcads.com
---

# KuramaSerp — Zero-Cost Google Ads SERP Scraper

Scrape competitor Google Ads from real search results. No API keys. No per-scrape costs. SERP APIs (SerpAPI, ValueSERP, DataForSEO) charge premium credits for ad data and often return 0 ads because Google doesn't serve ads to datacenter IPs. KuramaSerp runs a real browser on your machine — you see exactly what a searcher sees.

Built by [Kuda Chinhara](https://linkedin.com/in/kudachinhara) at [Agentic PPC Ads](https://agenticppcads.com).

---

## Setup (One-Time)

```bash
# Install Playwright (downloads Chromium ~400MB on first run)
npm install playwright
```

That's it. No API keys, no `.env`, no accounts.

**Requirements:** Node.js 18+, Playwright npm package.

---

## Triggers

- `scrape ads for {client}`
- `kurama-serp {client} {keywords}`
- `competitive ad scrape for {keywords} in {location}`
- `scrape Google Ads`
- `run kurama-serp`

---

## Quick Reference

| Option | Flag | Example |
|--------|------|---------|
| Client name | positional (required) | `acme-corp` |
| Keywords | `--keywords "kw1,kw2,kw3"` | `--keywords "plumber near me,emergency plumber"` |
| Location | `--location "City,State,Country"` | `--location "London,England,United Kingdom"` |
| Project preset | `--project <id>` | `--project proj_abc123` |
| Preview only | `--dry-run` | Shows config, no browser |
| Output root | `--root <path>` | `--root /path/to/project` (default: cwd) |

---

## How It Works

```
Keywords + Location
        │
        ▼
┌──────────────────────────────────────────┐
│  Playwright launches real Chromium       │
│  • Persistent profile (no CAPTCHAs)     │
│  • UULE geo-targeting (228K+ locations) │
│  • Non-headless (Google trusts it)       │
│  • 3-5s delay between searches          │
└──────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│  For each keyword:                       │
│  • Navigate to Google with UULE params  │
│  • Extract all ads (top + bottom)       │
│  • Capture: title, description, domain, │
│    position, sitelinks, extensions      │
└──────────────────────────────────────────┘
        │
        ▼
  3 output files in clients/{client}/ads/
```

---

## Invocation

When this skill is triggered, run the scraper script located in this skill's `scripts/` directory.

### Step 1: Gather inputs

Ask for (if not provided):
- **Client name** (required) — used for output directory naming
- **Keywords** (required) — comma-separated search terms
- **Location** (required) — Google canonical format: `"City,State,Country"`

### Step 2: Run the script

```bash
node {SKILL_DIR}/scripts/scrape-ads-playwright.cjs <client-name> \
  --keywords "keyword 1,keyword 2,keyword 3" \
  --location "City,State,Country"
```

Where `{SKILL_DIR}` is the directory containing this SKILL.md file.

**Important:** Run from the project root directory. Outputs are saved relative to the current working directory at `clients/{client}/ads/`.

### Step 3: Report results

After the script completes, read the generated summary file and present key findings:
- Total ads scraped and unique competitors
- Top competitors by ad presence
- Notable messaging patterns

---

## Outputs

Three files saved to `clients/{client}/ads/`:

| File | Contents |
|------|----------|
| `raw_ads_YYYY-MM-DD.json` | Flat array of every ad object as scraped |
| `ads_data_YYYY-MM-DD.json` | Ads grouped by domain and keyword, with statistics |
| `ads_summary_YYYY-MM-DD.md` | Readable report: competitor table, per-keyword ads, messaging patterns |

### Ad Object Fields

| Field | Description |
|-------|-------------|
| `keyword` | The search term that triggered this ad |
| `position` | 1, 2, 3... within its block |
| `block_position` | `top` or `bottom` of SERP |
| `title` | Ad headline |
| `description` | Ad body text |
| `domain` | Advertiser's domain |
| `displayed_link` | The green URL line shown in the ad |
| `link` | Actual destination URL |
| `sitelinks` | Array of sitelink titles |
| `extensions` | Ad extensions |
| `scraped_at` | ISO timestamp |

### Messaging Patterns Detected

The summary automatically scans all ad copy for these patterns:

| Pattern | What It Catches |
|---------|----------------|
| Pricing/cost | Prices, "from", "free", cost mentions |
| Urgency/speed | "urgent", "emergency", "24h", "today" |
| Social proof | Reviews, ratings, years in business, awards |
| CQC/regulation | Regulatory mentions, certifications |
| Local/geographic | "local", "near me", "nearby" |

---

## Geo Targeting

KuramaSerp uses **UULE encoding** — Google's own geo-targeting system used in Ads Editor. This tells Google to serve results as if the searcher is in that exact location, regardless of your actual IP.

### Location Format

Use Google's canonical location names: `"City,State/Region,Country"`

| Market | Example |
|--------|---------|
| UK | `"London,England,United Kingdom"` |
| US | `"Raleigh,North Carolina,United States"` |
| AU | `"Sydney,New South Wales,Australia"` |
| CA | `"Toronto,Ontario,Canada"` |

### Supported Markets

| Country | Google Domain | Locale |
|---------|--------------|--------|
| United Kingdom | google.co.uk | en-GB |
| United States | google.com | en-US |
| Australia | google.com.au | en-AU |
| Canada | google.ca | en-CA |

To add more markets, edit the `COUNTRY_PROFILES` object in the script.

---

## Projects List (Optional)

If your project root contains a `projects_list.json`, you can load keywords and location from it:

```bash
node {SKILL_DIR}/scripts/scrape-ads-playwright.cjs <client> --project <project_id>
```

Expected format:
```json
{
  "projects": [
    {
      "id": "proj_abc123",
      "name": "Acme Corp",
      "keywords": ["keyword 1", "keyword 2"],
      "location": "London,England,United Kingdom"
    }
  ]
}
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| 0 ads found | Budget exhausted, no ads running, or wrong geo | Try different time of day or verify keywords have ads |
| CAPTCHA / unusual traffic | First run or cleared profile | Run again — persistent profile builds trust over time |
| Playwright not found | Not installed | `npm install playwright` |
| Chromium download hangs | Firewall or slow connection | Wait or retry — ~400MB download |
| Wrong location results | Location string doesn't match Google's canonical format | Use exact format: `"City,State,Country"` |

---

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| Running 50+ keywords at once | Rate limiting, suspicious activity | Batch in groups of 10-15 |
| Running headless | Google detects and blocks | Script runs non-headless by design |
| Deleting `.playwright-profile/` | Resets trust, triggers CAPTCHAs | Keep it — it's your browser identity |
| Scraping every hour | Unnecessary, ads don't change that fast | Daily or weekly is sufficient |

---

*Built by [Kuda Chinhara](https://linkedin.com/in/kudachinhara) | [Agentic PPC Ads](https://agenticppcads.com) | [X: @AIPPCKuda](https://x.com/AIPPCKuda)*
