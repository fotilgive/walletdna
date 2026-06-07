import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = '/Users/Artem/Desktop/walletdna-screenshots';
const BASE = 'http://localhost:5174';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTc4MDg0ODUwNSwiZXhwIjoxNzgxNDUzMzA1fQ.g1cncWZYEBa18YX7PnY8zvweK15IHWnmy5lwpyG1_1I';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
});

async function shot(page, name) {
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`✅ ${name}.png`);
}

async function goAuth(page, path) {
  // Set token before navigating so initAuth() call succeeds with premium user
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate((token) => {
    localStorage.setItem('walletdna_token', token);
  }, TOKEN);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 30000 });
}

const page = await browser.newPage();

// 1. Landing page
await page.goto(`${BASE}/landing`, { waitUntil: 'networkidle2', timeout: 30000 });
await shot(page, '01-landing');

// Scroll to features section
await page.evaluate(() => window.scrollBy(0, 600));
await sleep(800);
await page.screenshot({ path: `${OUT}/02-landing-features.png` });
console.log('✅ 02-landing-features.png');

// 2. Login page
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
await shot(page, '03-login');

// 3. Pricing page
await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle2', timeout: 30000 });
await shot(page, '04-pricing');

// --- PREMIUM PAGES ---

// 4. Dashboard / Home
await goAuth(page, '/');
await shot(page, '05-dashboard');

// 5. Clusters - main feature
await goAuth(page, '/clusters');
await sleep(2000);
await shot(page, '06-clusters');

// Scroll down to see more cluster data
await page.evaluate(() => window.scrollBy(0, 400));
await sleep(800);
await page.screenshot({ path: `${OUT}/07-clusters-detail.png` });
console.log('✅ 07-clusters-detail.png');

// 6. Signal history
await goAuth(page, '/signal-history');
await sleep(2000);
await shot(page, '08-signal-history');

// 7. Hidden gems
await goAuth(page, '/hidden-gems');
await sleep(2000);
await shot(page, '09-hidden-gems');

// 8. Leaderboard
await goAuth(page, '/leaderboard');
await sleep(2000);
await shot(page, '10-leaderboard');

// 9. Wallet scanner/compare
await goAuth(page, '/compare');
await sleep(2000);
await shot(page, '11-compare');

await browser.close();
console.log(`\n🎉 Done! ${OUT}`);
