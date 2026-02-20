/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  KuramaSerp — Google Ads SERP Scraper                                      ║
 * ║                                                                            ║
 * ║  Built by Kuda Chinhara | Agentic PPC Ads                                  ║
 * ║  https://agenticppcads.com                                                 ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Why this exists:
 *   SERP APIs (SerpAPI, ValueSERP, DataForSEO, etc.) can scrape ads — but
 *   ad scraping is typically a premium feature. ValueSERP charges 4 credits
 *   per scrape instead of 1 when ads are included. Free/basic tiers often
 *   return 0 ads because Google doesn't serve ads to standard datacenter IPs.
 *   KuramaSerp uses a real Chromium browser on your machine — zero per-scrape
 *   cost, and you see exactly what a real searcher sees, including all paid ads.
 *
 * Features:
 *   - Real browser scraping via Playwright (not API-based)
 *   - Persistent Chrome profile to avoid CAPTCHAs
 *   - UULE geo-targeting using Google's 228K+ canonical locations
 *   - Multi-market support (US, UK, AU, CA — extensible)
 *   - Extracts: titles, descriptions, domains, positions, sitelinks
 *   - Outputs: raw JSON, structured data, markdown summary with messaging patterns
 *
 * Usage:
 *   node scrape-ads-playwright.cjs <client-name> [options]
 *
 * Options:
 *   --keywords "kw1,kw2"                  Override preset keywords
 *   --location "City,State,Country"       Set geo (overrides preset)
 *   --project <project_id>               Load keywords + location from projects_list.json
 *   --root <path>                        Project root for output (default: cwd)
 *   --dry-run                            Show config without launching browser
 *
 * Examples:
 *   node scrape-ads-playwright.cjs acme-corp --keywords "plumber near me" --location "London,England,United Kingdom"
 *   node scrape-ads-playwright.cjs acme-corp --project proj_abc123
 *   node scrape-ads-playwright.cjs acme-corp --dry-run
 *
 * Geo is resolved from: --location flag > --project > preset > default (UK)
 *
 * Requirements:
 *   - Node.js 18+
 *   - Playwright (`npm install playwright`)
 */

const fs = require('fs');
const path = require('path');

// ROOT = project root for outputs and config
// Priority: --root flag > current working directory
const ROOT = (() => {
  const idx = process.argv.indexOf('--root');
  return (idx !== -1 && process.argv[idx + 1]) ? path.resolve(process.argv[idx + 1]) : process.cwd();
})();

// ── Geo Profiles ────────────────────────────────────────────────────────────

const COUNTRY_PROFILES = {
  'United Kingdom': { domain: 'google.co.uk', gl: 'uk', locale: 'en-GB', timezoneId: 'Europe/London' },
  'United States': { domain: 'google.com', gl: 'us', locale: 'en-US', timezoneId: 'America/New_York' },
  'Australia':     { domain: 'google.com.au', gl: 'au', locale: 'en-AU', timezoneId: 'Australia/Sydney' },
  'Canada':        { domain: 'google.ca', gl: 'ca', locale: 'en-CA', timezoneId: 'America/Toronto' },
};

// US state → timezone (covers states from projects_list.json)
const US_TIMEZONES = {
  'California': 'America/Los_Angeles', 'Oregon': 'America/Los_Angeles',
  'New York': 'America/New_York', 'Florida': 'America/New_York',
  'North Carolina': 'America/New_York', 'Ohio': 'America/New_York',
  'Pennsylvania': 'America/New_York', 'Maryland': 'America/New_York',
  'Texas': 'America/Chicago',
};

// UK region → timezone (all the same, but keeps the pattern extensible)
const UK_TIMEZONES = {
  'England': 'Europe/London', 'Scotland': 'Europe/London', 'Wales': 'Europe/London',
};

/**
 * Encode a Google canonical location name into a UULE parameter.
 * UULE tells Google to serve results as if searching from that exact location.
 * Format: w+CAIQICI + base64url_char(length) + canonical_name
 *
 * The canonical names come from Google's geo targets list (228K locations).
 * Same format used in projects_list.json (e.g., "Raleigh,North Carolina,United States").
 */
function encodeUULE(canonicalName) {
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const lengthChar = B64[canonicalName.length] || B64[B64.length - 1];
  return 'w+CAIQICI' + lengthChar + canonicalName;
}

/**
 * Parse a location string like "Raleigh,North Carolina,United States" into geo config.
 * Returns { domain, gl, locale, timezoneId, uule, locationStr } or null if unparseable.
 *
 * Location strings should match Google's canonical names from the geo targets list.
 */
function resolveGeo(locationStr) {
  if (!locationStr) return null;

  const parts = locationStr.split(',').map(s => s.trim());
  // Expected: "City,State/Region,Country" or "State,Country" or "Country"
  const country = parts[parts.length - 1];
  const stateOrRegion = parts.length >= 2 ? parts[parts.length - 2] : null;

  const profile = COUNTRY_PROFILES[country];
  if (!profile) return null;

  const geo = { ...profile };

  // Refine timezone for US states
  if (country === 'United States' && stateOrRegion && US_TIMEZONES[stateOrRegion]) {
    geo.timezoneId = US_TIMEZONES[stateOrRegion];
  }

  // Generate UULE for precise geo-targeting (uses Google's canonical name format)
  geo.uule = encodeUULE(locationStr);
  geo.locationStr = locationStr;
  return geo;
}

// ── Client Presets ──────────────────────────────────────────────────────────

const KEYWORD_PRESETS = {
  // Add your client presets here:
  // 'client-name': {
  //   keywords: ['keyword 1', 'keyword 2', 'keyword 3 london'],
  //   location: 'London,England,United Kingdom',
  // },
};

// ── Arg parsing ─────────────────────────────────────────────────────────────

function parseArgs(args) {
  const parsed = { client: null, keywords: null, location: null, project: null, dryRun: false };
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--keywords') {
      parsed.keywords = args[++i].split(',').map(k => k.trim());
    } else if (args[i] === '--location') {
      parsed.location = args[++i];
    } else if (args[i] === '--project') {
      parsed.project = args[++i];
    } else if (args[i] === '--root') {
      i++; // skip value — already handled at module level
    } else if (args[i] === '--dry-run') {
      parsed.dryRun = true;
    } else if (!args[i].startsWith('--')) {
      parsed.client = args[i];
    }
    i++;
  }
  return parsed;
}

/**
 * Load a project from projects_list.json by ID.
 * Returns { keywords, location } or null.
 */
function loadProject(projectId) {
  const projectsPath = path.join(ROOT, 'projects_list.json');
  if (!fs.existsSync(projectsPath)) return null;
  const data = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  return data.projects.find(p => p.id === projectId) || null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Ad extraction ───────────────────────────────────────────────────────────

async function extractAds(page, keyword) {
  const now = new Date().toISOString();

  // Google Ads live inside <div role="region"> elements with an "Ads" heading.
  // We find all ad regions, then extract individual ads from each.
  const ads = await page.evaluate(() => {
    const results = [];

    // Find all ad regions (role="region" containing an h1 "Ads")
    const regions = document.querySelectorAll('[role="region"]');

    regions.forEach(region => {
      const heading = region.querySelector('h1');
      if (!heading || heading.textContent.trim() !== 'Ads') return;

      // Determine if this is top or bottom based on position
      const isBottom = region.getBoundingClientRect().top > 600;
      const blockPos = isBottom ? 'bottom' : 'top';

      // Each ad block has an h3 heading (the clickable title)
      const adHeadings = region.querySelectorAll('h3');
      const seen = new Set();
      let pos = 0;

      adHeadings.forEach(h3 => {
        const title = h3.textContent.trim();

        // Skip non-ad headings and duplicates
        if (!title || title === 'Ads' || title === 'Sponsored results' ||
            title === 'Sponsored result' || title === 'Hide sponsored results' ||
            title === 'Hide sponsored result' || seen.has(title)) return;
        seen.add(title);
        pos++;

        // Walk up to find the ad container (closest ancestor with a link)
        let container = h3.closest('[data-text-ad]') || h3.parentElement?.parentElement?.parentElement;
        if (!container) container = h3.parentElement;

        // Find the destination link — look for the link wrapping or near the h3
        let link = '';
        let displayedLink = '';
        const parentLink = h3.closest('a[href]');
        if (parentLink) {
          link = parentLink.href;
        } else {
          // Look for a sibling or ancestor link
          const nearbyLink = container.querySelector('a[href*="aclk"], a[href^="http"]');
          if (nearbyLink) link = nearbyLink.href;
        }

        // Find displayed link text (the green URL line)
        const adBlock = h3.closest('[role="region"]') || container;
        // Look for the domain display near this heading's parent
        const linkParent = h3.parentElement?.parentElement;
        if (linkParent) {
          const spans = linkParent.querySelectorAll('span');
          spans.forEach(s => {
            const t = s.textContent.trim();
            if (t.startsWith('https://') || t.startsWith('http://') || t.includes('.co.uk') || t.includes('.com') || t.includes('.org')) {
              if (!displayedLink) displayedLink = t;
            }
          });
        }

        // Find description — text block near the heading that isn't a link/button
        let description = '';
        // Walk siblings of the heading's container to find description text
        const walkParent = h3.parentElement?.parentElement?.parentElement;
        if (walkParent) {
          const textNodes = walkParent.querySelectorAll('div, span');
          const descCandidates = [];
          textNodes.forEach(n => {
            const t = n.textContent.trim();
            // Description-like text: longer than 40 chars, not a URL, not the title
            if (t.length > 40 && !t.startsWith('http') && t !== title &&
                !t.includes('Why this ad') && n.closest('h3') === null) {
              descCandidates.push(t);
            }
          });
          // Pick the longest unique candidate
          if (descCandidates.length > 0) {
            description = descCandidates.sort((a, b) => b.length - a.length)[0];
          }
        }

        // Find sitelinks (list items within the ad)
        const sitelinks = [];
        const sitelinkList = walkParent ? walkParent.querySelector('ul, [role="list"]') : null;
        if (sitelinkList) {
          sitelinkList.querySelectorAll('li').forEach(li => {
            const text = li.textContent.trim();
            if (text && text.length < 60) {
              sitelinks.push({ title: text, link: '' });
            }
          });
        }

        results.push({
          title,
          link,
          displayed_link: displayedLink,
          description,
          sitelinks,
          extensions: [],
          position: pos,
          block_position: blockPos,
        });
      });
    });

    return results;
  });

  // Normalize into our standard format
  return ads.map(ad => {
    let domain = '';
    try { domain = new URL(ad.link).hostname; } catch {}
    return {
      keyword,
      position: ad.position,
      block_position: ad.block_position,
      relative_block_position: ad.block_position,
      title: ad.title,
      link: ad.link,
      domain,
      displayed_link: ad.displayed_link,
      description: ad.description,
      sitelinks: ad.sitelinks,
      extensions: ad.extensions,
      scraped_at: now,
      source: 'playwright',
    };
  });
}

// ── Transform + Summary ─────────────────────────────────────────────────────

function buildTransformedData(allAds) {
  const competitors = {};
  const keywords = {};

  allAds.forEach(ad => {
    if (!competitors[ad.domain]) competitors[ad.domain] = [];
    competitors[ad.domain].push(ad);
    if (!keywords[ad.keyword]) keywords[ad.keyword] = [];
    keywords[ad.keyword].push(ad);
  });

  const stats = {};
  for (const [domain, domainAds] of Object.entries(competitors)) {
    const positions = domainAds.map(a => a.position);
    stats[domain] = {
      total_ads: domainAds.length,
      keywords_targeted: new Set(domainAds.map(a => a.keyword)).size,
      avg_position: Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10,
      titles: domainAds.map(a => a.title),
      descriptions: domainAds.map(a => a.description).filter(Boolean),
    };
  }

  return {
    metadata: {
      generated_at: new Date().toISOString(),
      source: 'playwright',
      total_ads: allAds.length,
      unique_domains: Object.keys(competitors).length,
      unique_keywords: Object.keys(keywords).length,
    },
    competitors,
    keywords,
    statistics: {
      total_ads: allAds.length,
      unique_domains: Object.keys(competitors).length,
      unique_keywords: Object.keys(keywords).length,
      competitors: stats,
    },
  };
}

function buildSummary(transformed, clientName, keywordList, geoInfo) {
  const { metadata, statistics } = transformed;
  const date = metadata.generated_at.split('T')[0];

  let md = `# ${clientName} — Google Ads Scrape (KuramaSerp)\n\n`;
  md += `**Date:** ${date}\n`;
  md += `**Source:** KuramaSerp (Playwright, ${geoInfo.domain})\n`;
  md += `**Location:** ${geoInfo.locationStr || 'default'}\n`;
  md += `**Keywords:** ${keywordList.join(', ')}\n\n`;
  md += `---\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|---|---|\n`;
  md += `| Total ads scraped | ${metadata.total_ads} |\n`;
  md += `| Unique competitors | ${metadata.unique_domains} |\n`;
  md += `| Keywords scraped | ${metadata.unique_keywords} |\n\n`;

  md += `## Competitors by Presence\n\n`;
  md += `| Domain | Ads | Keywords | Avg Position |\n|---|---|---|---|\n`;

  const sorted = Object.entries(statistics.competitors)
    .sort((a, b) => b[1].total_ads - a[1].total_ads);

  for (const [domain, s] of sorted) {
    md += `| ${domain} | ${s.total_ads} | ${s.keywords_targeted} | ${s.avg_position} |\n`;
  }

  md += `\n## Ads by Keyword\n\n`;

  for (const [kw, kwAds] of Object.entries(transformed.keywords)) {
    md += `### "${kw}" (${kwAds.length} ads)\n\n`;
    for (const ad of kwAds) {
      md += `**${ad.position}. ${ad.domain}**\n`;
      md += `> **${ad.title}**\n`;
      md += `> ${ad.description}\n`;
      if (ad.extensions.length > 0) {
        md += `> Extensions: ${ad.extensions.join(' | ')}\n`;
      }
      if (ad.sitelinks.length > 0) {
        md += `> Sitelinks: ${ad.sitelinks.map(s => s.title).join(' | ')}\n`;
      }
      md += `\n`;
    }
  }

  // Messaging patterns
  md += `## Messaging Patterns\n\n`;
  md += `| Pattern | Examples | Who |\n|---|---|---|\n`;

  const allText = [];
  for (const [domain, s] of sorted) {
    s.titles.forEach(t => allText.push({ domain, text: t }));
    s.descriptions.forEach(d => allText.push({ domain, text: d }));
  }

  const patterns = [
    { name: 'Pricing/cost', regex: /£|\$|\bfrom\b.*\d|price|cost|free/i },
    { name: 'Urgency/speed', regex: /urgent|emergency|immediate|24.?h|today|quick|fast/i },
    { name: 'Social proof', regex: /\d+\+?\s*(carer|year|review|client|star|rated|award|trust)/i },
    { name: 'CQC/regulation', regex: /cqc|regulat|registered|inspected|verified/i },
    { name: 'Local/geographic', regex: /\blocal\b|near me|\bnearby\b/i },
  ];

  for (const p of patterns) {
    const matches = allText.filter(t => p.regex.test(t.text));
    if (matches.length > 0) {
      const examples = matches.slice(0, 2).map(a => `"${a.text.slice(0, 60)}"`).join(', ');
      const who = [...new Set(matches.map(a => a.domain))].join(', ');
      md += `| ${p.name} | ${examples} | ${who} |\n`;
    }
  }

  md += `\n---\n\n`;
  md += `*Generated by KuramaSerp — https://agenticppcads.com*\n`;

  return md;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.client) {
    console.error('Usage: node scrape-ads-playwright.cjs <client-name> [options]');
    console.error('\nOptions:');
    console.error('  --keywords "kw1,kw2"                  Override keywords');
    console.error('  --location "City,State,Country"       Set geo target');
    console.error('  --project <project_id>               Load from projects_list.json');
    console.error('  --root <path>                        Project root (default: cwd)');
    console.error('  --dry-run                            Preview without browser');
    console.error('\nPresets:', Object.keys(KEYWORD_PRESETS).join(', ') || '(none)');
    process.exit(1);
  }

  // Resolve keywords and location from: CLI flags > project > preset
  const preset = KEYWORD_PRESETS[args.client] || {};
  let keywords = args.keywords;
  let locationStr = args.location;

  // Load from project if specified
  if (args.project) {
    const project = loadProject(args.project);
    if (!project) {
      console.error(`Project "${args.project}" not found in projects_list.json`);
      process.exit(1);
    }
    if (!keywords) keywords = project.keywords;
    if (!locationStr) locationStr = project.location;
    console.log(`   Loaded project: ${project.name}`);
  }

  // Fall back to preset
  if (!keywords) keywords = preset.keywords;
  if (!locationStr) locationStr = preset.location;

  if (!keywords || keywords.length === 0) {
    console.error(`No keywords — pass --keywords "kw1,kw2", --project <id>, or add a preset for "${args.client}"`);
    process.exit(1);
  }

  // Resolve geo from location string
  const geo = resolveGeo(locationStr) || COUNTRY_PROFILES['United Kingdom'];
  const domain = geo.domain;

  console.log(`\n🔍 KuramaSerp — Google Ads Scraper`);
  console.log(`   Client:   ${args.client}`);
  console.log(`   Keywords: ${keywords.join(', ')}`);
  console.log(`   Location: ${locationStr || 'default (UK)'}`);
  console.log(`   Domain:   ${domain}`);
  console.log(`   Locale:   ${geo.locale} | TZ: ${geo.timezoneId} | gl=${geo.gl}`);
  if (geo.uule) console.log(`   UULE:     ${geo.uule.slice(0, 30)}...`);
  console.log(`   Root:     ${ROOT}`);
  console.log(`   Searches: ${keywords.length}\n`);

  if (args.dryRun) {
    console.log('🏁 Dry run — no browser launched.');
    return;
  }

  const { chromium } = require('playwright');

  // Use persistent Chrome profile so Google trusts us (no CAPTCHA)
  const profileDir = path.join(ROOT, '.playwright-profile');
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    locale: geo.locale,
    timezoneId: geo.timezoneId,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] || await context.newPage();

  const allAds = [];
  const errors = [];

  try {
    // Navigate to Google and handle cookie consent
    console.log('   Launching browser...');
    await page.goto(`https://${domain}`, { waitUntil: 'domcontentloaded' });

    // Accept cookies if dialog appears
    try {
      const acceptBtn = page.locator('button:has-text("Accept all"), button:has-text("Accept")').first();
      await acceptBtn.click({ timeout: 3000 });
      console.log('   Cookie consent accepted');
      await sleep(1000);
    } catch {
      // No cookie dialog, continue
    }

    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i];
      process.stdout.write(`   [${i + 1}/${keywords.length}] "${kw}" ... `);

      try {
        // Build search URL with geo params
        // UULE = Google's canonical location encoding for precise geo-targeting
        let searchUrl = `https://${domain}/search?q=${encodeURIComponent(kw)}&gl=${geo.gl}&hl=en`;
        if (geo.uule) searchUrl += `&uule=${encodeURIComponent(geo.uule)}`;

        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });

        // Wait for results — use multiple fallback selectors
        await page.waitForSelector('main, #search, #rso, #center_col, h1', { timeout: 15000 });
        await sleep(2000); // Let ads render fully

        const ads = await extractAds(page, kw);
        allAds.push(...ads);
        console.log(`${ads.length} ads found`);

        // Respectful delay between searches
        if (i < keywords.length - 1) await sleep(3000 + Math.random() * 2000);
      } catch (err) {
        console.log(`ERROR: ${err.message}`);
        errors.push({ keyword: kw, error: err.message });
      }
    }
  } finally {
    await context.close();
    console.log('   Browser closed.');
  }

  if (allAds.length === 0) {
    console.log('\n⚠️  No ads found. This could mean:');
    console.log('   - Competitors aren\'t running ads on these terms right now');
    console.log('   - Ads budgets are exhausted for today');
    console.log('   - Google detected headless browser (try running at different time)');
    console.log('\n   Files saved anyway (empty) for the record.\n');
  }

  // Build outputs
  const transformed = buildTransformedData(allAds);
  const summary = buildSummary(transformed, args.client, keywords, geo);
  const date = new Date().toISOString().split('T')[0];

  // Save files
  const adsDir = path.join(ROOT, 'clients', args.client, 'ads');
  fs.mkdirSync(adsDir, { recursive: true });

  const rawPath = path.join(adsDir, `raw_ads_${date}.json`);
  const dataPath = path.join(adsDir, `ads_data_${date}.json`);
  const summaryPath = path.join(adsDir, `ads_summary_${date}.md`);

  fs.writeFileSync(rawPath, JSON.stringify(allAds, null, 2));
  fs.writeFileSync(dataPath, JSON.stringify(transformed, null, 2));
  fs.writeFileSync(summaryPath, summary);

  console.log(`\n✅ Done — ${allAds.length} ads from ${transformed.metadata.unique_domains} competitors\n`);
  console.log(`📁 Saved to clients/${args.client}/ads/`);
  console.log(`   raw_ads_${date}.json        — raw ad data`);
  console.log(`   ads_data_${date}.json       — transformed + stats`);
  console.log(`   ads_summary_${date}.md      — readable report`);

  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} keyword(s) failed:`);
    errors.forEach(e => console.log(`   - "${e.keyword}": ${e.error}`));
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  KuramaSerp — Built by Kuda Chinhara | Agentic PPC Ads                    ║
 * ║                                                                            ║
 * ║  We build AI-powered Google Ads tools for agencies and in-house teams.     ║
 * ║  If you found this useful, let's connect:                                  ║
 * ║                                                                            ║
 * ║  Web:      https://agenticppcads.com                                       ║
 * ║  LinkedIn: https://linkedin.com/in/kudachinhara                            ║
 * ║  X:        https://x.com/kudachinhara                                         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
