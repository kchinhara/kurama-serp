# KuramaSerp — Zero-Cost Google Ads SERP Scraper

Scrape competitor Google Ads from real search results. No API keys. No per-scrape costs.

SERP APIs (SerpAPI, ValueSERP, DataForSEO) charge premium credits for ad data — and on free or basic tiers, ad results are limited or unavailable entirely. KuramaSerp eliminates that cost by running a real Chromium browser on your machine, so you see exactly what a searcher sees.

## What You Get

For each scrape, KuramaSerp outputs 3 files:

| File | What's Inside |
|------|---------------|
| `raw_ads_YYYY-MM-DD.json` | Every ad object as scraped |
| `ads_data_YYYY-MM-DD.json` | Ads grouped by domain + keyword, with statistics |
| `ads_summary_YYYY-MM-DD.md` | Competitor table, per-keyword ads, messaging pattern detection |

**Per ad:** title, description, domain, position, displayed link, destination URL, sitelinks, extensions, timestamp.

**Messaging patterns detected:** pricing/cost signals, urgency/speed, social proof, regulatory mentions, local/geographic references.

## Install as Claude Code Skill

```bash
# Copy into your skills directory
cp -r kurama-serp ~/.claude/skills/kurama-serp

# Or for a project
cp -r kurama-serp your-project/.claude/skills/kurama-serp

# Install the dependency
npm install playwright
```

Then just tell Claude: `scrape ads for acme-corp --keywords "plumber near me" --location "London,England,United Kingdom"`

## Standalone CLI Usage

You can also run the script directly without Claude:

```bash
node scripts/scrape-ads-playwright.cjs <client-name> \
  --keywords "keyword 1,keyword 2" \
  --location "City,State,Country"
```

### Options

| Flag | Description |
|------|-------------|
| `--keywords "kw1,kw2"` | Search terms (comma-separated) |
| `--location "City,State,Country"` | Google canonical location for geo-targeting |
| `--project <id>` | Load keywords + location from `projects_list.json` |
| `--proxy <url>` | Route browser through a proxy (see [VPN / Proxy](#vpn--proxy-required-for-cross-country-scraping)) |
| `--root <path>` | Output directory (default: current directory) |
| `--dry-run` | Preview config without launching browser |

### Examples

```bash
# UK search
node scripts/scrape-ads-playwright.cjs acme-corp \
  --keywords "home care agency,live-in care" \
  --location "London,England,United Kingdom"

# US search
node scripts/scrape-ads-playwright.cjs acme-corp \
  --keywords "google ads agency" \
  --location "New York,New York,United States"

# With a proxy (for cross-country scraping)
node scripts/scrape-ads-playwright.cjs acme-corp \
  --keywords "home care agency" \
  --location "London,England,United Kingdom" \
  --proxy "socks5://127.0.0.1:1080"

# Dry run (preview only)
node scripts/scrape-ads-playwright.cjs acme-corp \
  --keywords "plumber near me" \
  --dry-run
```

## VPN / Proxy (Required for Cross-Country Scraping)

**This is the #1 gotcha.** If you're scraping ads for a country you're not physically in, you'll get 0 ads unless you use a VPN or proxy.

KuramaSerp uses UULE encoding to tell Google your location — and this works perfectly for **organic results and local pack**. But **Google Ads uses your real IP address** for the ad auction. Advertisers targeting "People physically IN this location" won't serve ads to an IP outside that region, even with perfect UULE geo-targeting.

| What | What Controls It |
|------|-----------------|
| Organic results, local pack | UULE (works without VPN) |
| **Google Ads auction** | **Your real IP address** |

### How to Fix It

**Option 1: VPN (simplest)** — Connect to a server in the target country before running the script.

**Option 2: `--proxy` flag** — Route browser traffic through a proxy:

```bash
# SOCKS5 proxy (e.g. SSH tunnel to a UK VPS)
node scripts/scrape-ads-playwright.cjs acme-corp \
  --keywords "plumber near me" \
  --location "London,England,United Kingdom" \
  --proxy "socks5://127.0.0.1:1080"

# HTTP proxy with auth (e.g. Bright Data, Oxylabs)
node scripts/scrape-ads-playwright.cjs acme-corp \
  --keywords "plumber near me" \
  --location "London,England,United Kingdom" \
  --proxy "http://user:pass@gb.proxy.io:22225"
```

Supported formats: `socks5://host:port`, `http://host:port`, `http://user:pass@host:port`

**Cheapest option:** A small UK/US VPS (Hetzner, DigitalOcean — ~$4/mo), then SSH tunnel: `ssh -D 1080 user@vps` and pass `--proxy "socks5://127.0.0.1:1080"`.

## Geo Targeting

KuramaSerp uses **UULE encoding** — Google's own location system used in Ads Editor. Combined with a matching IP (via VPN or proxy), this gives you results identical to what a real searcher in that location would see.

### Supported Markets

| Country | Domain | Location Example |
|---------|--------|-----------------|
| United Kingdom | google.co.uk | `"London,England,United Kingdom"` |
| United States | google.com | `"Raleigh,North Carolina,United States"` |
| Australia | google.com.au | `"Sydney,New South Wales,Australia"` |
| Canada | google.ca | `"Toronto,Ontario,Canada"` |

Add more markets by editing `COUNTRY_PROFILES` in the script.

## Requirements

- Node.js 18+
- Playwright (`npm install playwright` — downloads Chromium ~400MB on first run)
- **VPN or proxy** in the target country (for ad scraping — see above)

No API keys, no `.env`, no accounts.

## How It Works

1. Launches a real Chromium browser with a persistent profile (avoids CAPTCHAs)
2. Navigates to the correct Google domain with UULE geo-targeting parameters
3. For each keyword: loads the SERP, waits for ads to render, extracts all ad data
4. Outputs raw JSON, structured data grouped by competitor, and a markdown summary
5. 3-5 second delay between searches to stay under the radar

## Tips

- **First run** may trigger a Google consent dialog — just accept it, the persistent profile remembers
- **Batch keywords** in groups of 10-15 to avoid rate limiting
- **Don't delete** `.playwright-profile/` — it's your trusted browser identity
- **Daily or weekly** scraping is sufficient; ads don't change hourly

## License

MIT

## Author

Built by [Kuda Chinhara](https://linkedin.com/in/kudachinhara) at [Agentic PPC Ads](https://agenticppcads.com).

We build AI-powered Google Ads tools for agencies and in-house teams.

- Web: [agenticppcads.com](https://agenticppcads.com)
- LinkedIn: [linkedin.com/in/kudachinhara](https://linkedin.com/in/kudachinhara)
- X: [@kudachinhara](https://x.com/kudachinhara)
