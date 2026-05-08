const { chromium } = require('playwright');

const HEADLESS = process.env.HEADLESS !== 'false';
const DELAY_MIN = parseInt(process.env.DELAY_MIN || '1500');
const DELAY_MAX = parseInt(process.env.DELAY_MAX || '3000');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
  const ms = DELAY_MIN + Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN));
  return sleep(ms);
}

async function extractBusinessDetails(page) {
  try {
    await page.waitForSelector('h1.DUwDvf, h1[class*="fontHeadlineLarge"]', { timeout: 8000 });
  } catch {
    return null;
  }

  const details = await page.evaluate(() => {
    const getText = sel => {
      const el = document.querySelector(sel);
      return el ? el.textContent.trim() : null;
    };
    const getAttr = (sel, attr) => {
      const el = document.querySelector(sel);
      return el ? el.getAttribute(attr) : null;
    };

    const name = getText('h1.DUwDvf') || getText('h1[class*="fontHeadlineLarge"]');

    const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
    const rating = ratingEl ? parseFloat(ratingEl.textContent) : null;

    const reviewsEl = document.querySelector('div.F7nice span[aria-label*="review"], button[aria-label*="review"]');
    let reviews_count = null;
    if (reviewsEl) {
      const match = (reviewsEl.getAttribute('aria-label') || reviewsEl.textContent).match(/[\d,]+/);
      if (match) reviews_count = parseInt(match[0].replace(/,/g, ''));
    }

    const addressEl = document.querySelector('button[data-item-id="address"] .Io6YTe');
    const address = addressEl ? addressEl.textContent.trim() : null;

    const phoneEl = document.querySelector('button[data-item-id^="phone"] .Io6YTe');
    const phone = phoneEl ? phoneEl.textContent.trim() : null;

    const websiteEl = document.querySelector('a[data-item-id="authority"] .Io6YTe');
    const website = websiteEl ? websiteEl.textContent.trim() : null;

    const websiteHref = getAttr('a[data-item-id="authority"]', 'href');

    return { name, rating, reviews_count, address, phone, website: websiteHref || website };
  });

  return details;
}

async function scrapeGoogleMaps(query, onProgress, maxResults = 60) {
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });

  const page = await context.newPage();
  const leads = [];

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    onProgress(`Navigating to Google Maps: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay();

    // Dismiss consent dialogs if present
    try {
      const consentBtn = await page.$('button[aria-label*="Accept"], button[jsname="b3VHJd"]');
      if (consentBtn) {
        await consentBtn.click();
        await sleep(1000);
      }
    } catch {}

    // Wait for the results list panel
    await page.waitForSelector('div[role="feed"], div.m6QErb', { timeout: 15000 });
    onProgress('Results list loaded. Starting to scroll and extract...');

    const resultsPanel = await page.$('div[role="feed"]');
    let prevCount = 0;
    let noNewResultsCount = 0;

    // Scroll to load more results
    while (leads.length < maxResults && noNewResultsCount < 4) {
      if (resultsPanel) {
        await resultsPanel.evaluate(el => el.scrollBy(0, 1000));
      }
      await sleep(1200);

      const cards = await page.$$('div[role="feed"] > div > div[jsaction]');
      if (cards.length === prevCount) {
        noNewResultsCount++;
      } else {
        noNewResultsCount = 0;
        prevCount = cards.length;
      }

      const endText = await page.$('span.HlvSq');
      if (endText) {
        onProgress('Reached end of results list.');
        break;
      }
    }

    // Get all result cards
    const cards = await page.$$('div[role="feed"] > div > div[jsaction]');
    onProgress(`Found ${cards.length} business cards. Processing each...`);

    for (let i = 0; i < Math.min(cards.length, maxResults); i++) {
      try {
        const card = cards[i];

        // Get initial info from the card
        const cardInfo = await card.evaluate(el => {
          const nameEl = el.querySelector('.qBF1Pd, .fontHeadlineSmall');
          const ratingEl = el.querySelector('span.MW4etd');
          const reviewsEl = el.querySelector('span.UY7F9');
          const addressEl = el.querySelector('.W4Efsd:last-child .W4Efsd');

          return {
            name: nameEl ? nameEl.textContent.trim() : null,
            rating: ratingEl ? parseFloat(ratingEl.textContent) : null,
            reviews_count: reviewsEl
              ? parseInt(reviewsEl.textContent.replace(/[(),.]/g, '').trim())
              : null,
            address_hint: addressEl ? addressEl.textContent.trim() : null,
          };
        });

        if (!cardInfo.name) continue;

        onProgress(`[${i + 1}/${Math.min(cards.length, maxResults)}] Clicking: ${cardInfo.name}`);

        // Click the card to open the detail panel
        await card.click();
        await randomDelay();

        const details = await extractBusinessDetails(page);

        if (!details) {
          onProgress(`  ⚠ Could not extract details for: ${cardInfo.name}`);
          continue;
        }

        const google_maps_url = page.url();

        const lead = {
          name: details.name || cardInfo.name,
          address: details.address || cardInfo.address_hint || null,
          phone: details.phone || null,
          website: details.website || null,
          google_maps_url,
          rating: details.rating ?? cardInfo.rating ?? null,
          reviews_count: details.reviews_count ?? cardInfo.reviews_count ?? null,
          email: null,
          tags: ['normal'],
        };

        leads.push(lead);
        onProgress(`  ✓ ${lead.name} | Rating: ${lead.rating ?? 'N/A'} | Phone: ${lead.phone ?? 'N/A'} | Website: ${lead.website ?? 'N/A'}`);

        await randomDelay();

        // Navigate back to the list
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await sleep(800);
        await page.waitForSelector('div[role="feed"]', { timeout: 10000 }).catch(() => {});

      } catch (err) {
        onProgress(`  ✗ Error processing card ${i + 1}: ${err.message}`);
        // Try to recover by navigating back
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        await sleep(1000);
      }
    }

  } finally {
    await browser.close();
  }

  onProgress(`Scraping complete. Total leads extracted: ${leads.length}`);
  return leads;
}

module.exports = { scrapeGoogleMaps };
