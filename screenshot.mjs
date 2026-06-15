import puppeteer from 'puppeteer-core';
import { mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = './temporary screenshots';

mkdirSync(OUT_DIR, { recursive: true });

const url   = process.argv[2] ?? 'http://localhost:3000';
const label = process.argv[3] ?? '';

// Auto-increment filename
const existing = readdirSync(OUT_DIR).filter(f => f.endsWith('.png'));
const nums = existing.map(f => parseInt(f.match(/^screenshot-(\d+)/)?.[1] ?? 0)).filter(Boolean);
const next = nums.length ? Math.max(...nums) + 1 : 1;
const name = label ? `screenshot-${next}-${label}.png` : `screenshot-${next}.png`;
const out  = join(OUT_DIR, name);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
await page.screenshot({ path: out, fullPage: true });
await browser.close();

console.log(`Saved → ${out}`);
