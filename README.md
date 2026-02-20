# KuramaSerp — Zero-Cost Google Ads SERP Scraper

Scrape competitor Google Ads from real search results. No API keys. No per-scrape costs.

SERP APIs (SerpAPI, ValueSERP, DataForSEO) charge premium credits for ad data and often return 0 ads — because Google doesn't serve ads to datacenter IPs. KuramaSerp runs a real Chromium browser on your machine, so you see exactly what a searcher sees.

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

# Dry run (preview only)
node scripts/scrape-ads-playwright.cjs acme-corp \
  --keywords "plumber near me" \
  --dry-run
```

## Geo Targeting

KuramaSerp uses **UULE encoding** — Google's own location system. Results are served as if the searcher is physically in that location, regardless of your actual IP.

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

That's it. No API keys, no `.env`, no accounts.

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
- X: [@kudachinhara](https://x.com/AIPPCKuda)
