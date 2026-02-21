---
name: kurama-serp
description: Zero-cost Google Ads SERP scraper. Uses a real Chromium browser via Playwright to scrape competitor ads from Google Search with precise geo-targeting. Outputs raw JSON, structured competitive data, and a markdown report with messaging pattern detection. No API keys, no per-scrape costs.
license: MIT
metadata:
  version: 1.1.0
  author: Kuda Chinhara
  url: https://agenticppcads.com
---

# KuramaSerp — Zero-Cost Google Ads SERP Scraper

Scrape competitor Google Ads from real search results. No API keys. No per-scrape costs. SERP APIs (SerpAPI, ValueSERP, DataForSEO) charge premium credits for ad data — and on free or basic tiers, ad results are limited or unavailable entirely. KuramaSerp eliminates that cost by running a real browser on your machine — you see exactly what a searcher sees.

Built by [Kuda Chinhara](https://linkedin.com/in/kudachinhara) at [Agentic PPC Ads](https://agenticppcads.com).

---

## Setup (One-Time)

```bash
# Install Playwright (downloads Chromium ~400MB on first run)
npm install playwright
```

That's it. No API keys, no `.env`, no accounts.

**Requirements:** Node.js 18+, Playwright npm package.

### VPN Requirement for Ad Scraping

**If you're scraping ads for a country you're not physically in, you need a VPN or proxy with an IP in the target country.** This is non-optional for ad data — Google Ads uses your real IP address to determine ad auction eligibility, and UULE geo-targeting alone won't override it.

For example, scraping UK ads from outside the UK will return 0 ads unless you:
- Connect to a **UK VPN** before running the script, OR
- Pass `--proxy "socks5://uk-server:1080"` to route browser traffic through a UK exit node

Cheapest options:
- **VPN service** (NordVPN, Mullvad, etc.) — connect to target country server
- **SSH tunnel** to a VPS in the target country — `ssh -D 1080 user@uk-vps`, then `--proxy "socks5://127.0.0.1:1080"`
- **Residential proxy** (Bright Data, Oxylabs) — `--proxy "http://user:pass@gb.proxy.io:22225"`

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
| Proxy | `--proxy <url>` | `--proxy "socks5://uk-server:1080"` |
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
- **Location** (required) — present the common locations below as selectable options (use AskUserQuestion with these as choices, plus an "Other" option for custom input):

#### Common Locations (Google canonical format)

**United Kingdom:**
| Label | Value |
|-------|-------|
| London, UK | `London,England,United Kingdom` |
| Manchester, UK | `Manchester,England,United Kingdom` |
| Birmingham, UK | `Birmingham,England,United Kingdom` |
| Edinburgh, UK | `Edinburgh,Scotland,United Kingdom` |

**United States:**
| Label | Value |
|-------|-------|
| New York, US | `New York,New York,United States` |
| Los Angeles, US | `Los Angeles,California,United States` |
| Chicago, US | `Chicago,Illinois,United States` |
| Houston, US | `Houston,Texas,United States` |

**Australia:**
| Label | Value |
|-------|-------|
| Sydney, AU | `Sydney,New South Wales,Australia` |
| Melbourne, AU | `Melbourne,Victoria,Australia` |

**Canada:**
| Label | Value |
|-------|-------|
| Toronto, CA | `Toronto,Ontario,Canada` |
| Vancouver, CA | `Vancouver,British Columbia,Canada` |

If the user selects "Other", ask them to provide the location in `"City,State/Region,Country"` format.

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

KuramaSerp uses **UULE encoding** — Google's own geo-targeting system used in Ads Editor. This tells Google to serve results as if the searcher is in that exact location.

### UULE vs IP — Why Proxy Matters for Ads

UULE controls the **location context** for organic results and local pack. But **Google Ads uses your real IP** for the ad auction. Advertisers targeting "People physically IN this location" won't serve ads to an IP outside that region — even with perfect UULE.

| What | Controlled by |
|------|---------------|
| Organic results, local pack | UULE (works without proxy) |
| Ad auction eligibility | **Real IP address** |
| "People IN location" targeting | **Real IP address** |
| "People searching FOR location" targeting | UULE + query context |

**If scraping from outside the target country, use `--proxy` with an exit node in the target market:**

```bash
node {SKILL_DIR}/scripts/scrape-ads-playwright.cjs acme-corp \
  --keywords "plumber near me" \
  --location "London,England,United Kingdom" \
  --proxy "socks5://uk-proxy:1080"
```

Supported proxy formats:
- `socks5://host:port`
- `http://host:port`
- `http://user:pass@host:port`

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
| 0 ads found, `#tads` empty | **Your IP is outside the target country** | Connect VPN to target country or use `--proxy` — this is the #1 cause |
| 0 ads found, no `#tads` | Budget exhausted or no ads running | Try during business hours in the target market (9-11am local) |
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

*Built by [Kuda Chinhara](https://linkedin.com/in/kudachinhara) | [Agentic PPC Ads](https://agenticppcads.com) | [X: @kudachinhara](https://x.com/kudachinhara)*
