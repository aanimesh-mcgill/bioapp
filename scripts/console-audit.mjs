/**
 * Crawl app routes, bottom nav, and safe UI actions; collect console/page errors.
 * Usage: npm run console-audit
 * Env: APP_URL (default https://localhost:5175), E2E_EMAIL, E2E_PASSWORD
 */
import { chromium } from 'playwright';

const BASE = process.env.APP_URL ?? 'https://localhost:5175';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD ?? 'AuditTest123!';

const EXTENSION_NOISE = [
  /ActionableCoachmark/,
  /showOneChild/,
  /content-script/,
  /chrome-extension/,
  /jquery-3\.1\.1/,
  /ShowOneChild/,
];

const findings = [];

function isAppError(text) {
  return !EXTENSION_NOISE.some((re) => re.test(text));
}

function record(scope, type, message, url) {
  if (!isAppError(message)) return;
  findings.push({ scope, type, message: message.slice(0, 500), url });
}

function attachListeners(page, scope) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      record(scope, 'console.error', msg.text(), page.url());
    }
  });
  page.on('pageerror', (err) => {
    record(scope, 'pageerror', err.message, page.url());
  });
}

async function waitForApp(page, ms = 3000) {
  await page.waitForTimeout(ms);
}

async function testLoginPageActions(page) {
  attachListeners(page, 'action:/login');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page, 2000);

  await page.getByRole('button', { name: /Sign up|साइन अप/i }).click();
  await waitForApp(page, 500);
  await page.getByRole('button', { name: /Sign In|साइन इन/i }).click();
  await waitForApp(page, 500);

  const showPwd = page.getByRole('button', { name: /Show|देखें/i });
  if (await showPwd.isVisible().catch(() => false)) {
    await showPwd.click();
    await waitForApp(page, 300);
    await page.getByRole('button', { name: /Hide|छिपाएं/i }).click().catch(() => undefined);
  }
}

async function ensureAuth(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page, 2000);

  const email = EMAIL ?? `audit.${Date.now()}@mailinator.com`;
  const password = PASSWORD;

  if (EMAIL) {
    await page.getByPlaceholder(/email|ईमेल/i).fill(email);
    await page.getByPlaceholder(/password|पासवर्ड/i).fill(password);
    await page.getByRole('button', { name: /Sign In|साइन इन/i }).click();
    await waitForApp(page, 4000);
    if (!page.url().includes('/login')) return { email, authed: true };
  }

  await page.getByRole('button', { name: /Sign up|साइन अप/i }).click();
  await waitForApp(page, 400);
  await page.getByPlaceholder(/name|नाम/i).fill('Audit User');
  await page.getByPlaceholder(/email|ईमेल/i).fill(email);
  const pwdFields = page.getByPlaceholder(/password|पासवर्ड/i);
  await pwdFields.first().fill(password);
  if ((await pwdFields.count()) > 1) await pwdFields.nth(1).fill(password);
  await page.getByRole('button', { name: /Create Account|खाता बनाएं/i }).click();
  await waitForApp(page, 5000);

  return { email, authed: !page.url().includes('/login') };
}

async function visit(page, path, scope) {
  attachListeners(page, scope);
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForApp(page, 3000);
    return page.url();
  } catch (err) {
    record(scope, 'navigation', err.message, `${BASE}${path}`);
    return null;
  }
}

async function runActions(page, path) {
  const scope = `action:${path}`;

  if (path === '/books') {
    const sharingTab = page.getByRole('button', { name: /Active & Sharing/i });
    if (await sharingTab.isVisible().catch(() => false)) {
      await sharingTab.click();
      await waitForApp(page, 800);
      const manageTab = page.getByRole('button', { name: /My Books/i });
      await manageTab.click();
      await waitForApp(page, 800);
    }
  }

  if (path === '/record') {
    const input = page.getByPlaceholder(/Story title|शीर्षक/i);
    if (await input.isVisible().catch(() => false)) {
      await input.fill('Audit test story');
      await waitForApp(page, 400);
      await input.fill('');
    }
  }

  if (path === '/settings') {
    const langSelect = page.locator('select.input-field').first();
    if (await langSelect.isVisible().catch(() => false)) {
      await langSelect.selectOption('mixed');
      await page.getByRole('button', { name: /Save|सहेजें/i }).click();
      await waitForApp(page, 1500);
    }
  }

  if (path === '/add-stimulus') {
    const photoTab = page.getByRole('button', { name: /Photo|फोटो/i });
    if (await photoTab.isVisible().catch(() => false)) {
      await photoTab.click();
      await waitForApp(page, 500);
      await page.getByRole('button', { name: /Text|टेक्स्ट/i }).click().catch(() => undefined);
    }
  }

  if (path === '/prompts') {
    await waitForApp(page, 800);
  }

  if (path === '/stories') {
    const link = page.getByRole('link', { name: /View draft|Review & approve|ड्राफ्ट|समीक्षा/i }).first();
    if (await link.isVisible().catch(() => false)) {
      attachListeners(page, `${scope}:open-detail`);
      await link.click();
      await waitForApp(page, 3000);
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
      await waitForApp(page, 1500);
    }
  }

  if (path === '/') {
    await page.getByRole('link', { name: /Books|पुस्तकें/i }).click().catch(() => undefined);
    await waitForApp(page, 2000);
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page, 1500);
  }
}

async function testBottomNav(page) {
  const nav = page.locator('nav').last();
  for (const href of ['/', '/prompts', '/book', '/stories']) {
    attachListeners(page, `nav:${href}`);
    await nav.locator(`a[href="${href}"]`).click();
    await waitForApp(page, 2500);
  }
}

async function main() {
  console.log(`Console audit → ${BASE}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await testLoginPageActions(page);

  for (const [path, scope] of [
    ['/browse/invalid-token', 'public:/browse/invalid-token'],
    ['/read/nonexistent-book', 'public:/read/nonexistent-book'],
    ['/invite/invalid-token', 'public:/invite/invalid-token'],
  ]) {
    await visit(page, path, scope);
  }

  const auth = await ensureAuth(page);
  console.log(`Auth: ${auth.authed ? 'ok' : 'FAILED'} (${auth.email})`);

  if (!auth.authed) {
    record('auth', 'fatal', 'Could not authenticate for protected route audit', `${BASE}/login`);
  } else {
    const authRoutes = [
      '/',
      '/books',
      '/invitations',
      '/record',
      '/prompts',
      '/add-stimulus',
      '/book',
      '/book/album',
      '/stories',
      '/contribute',
      '/settings',
    ];

    for (const path of authRoutes) {
      await visit(page, path, `page:${path}`);
      await runActions(page, path);
    }

    await testBottomNav(page);

    const sessionLink = page.getByRole('link', { name: /Continue recording|रिकॉर्ड जारी|Add clips/i }).first();
    if (await sessionLink.isVisible().catch(() => false)) {
      attachListeners(page, 'page:/story/:id');
      await sessionLink.click();
      await waitForApp(page, 3000);
    }
  }

  await browser.close();

  const unique = new Map();
  for (const f of findings) {
    unique.set(`${f.scope}|${f.type}|${f.message}`, f);
  }
  const list = [...unique.values()];

  console.log('\n=== Console audit results ===');
  if (list.length === 0) {
    console.log('No app console errors detected.');
    process.exit(0);
  }

  for (const f of list) {
    console.log(`\n[${f.scope}] ${f.type}`);
    console.log(`  ${f.message}`);
    if (f.url) console.log(`  @ ${f.url}`);
  }

  console.log(`\nTotal app issues: ${list.length}`);
  process.exit(1);
}

main().catch((err) => {
  console.error('Audit script failed:', err.message);
  process.exit(1);
});
