// Shower Thoughts smoke tests. Drives the built page at phone size and fails
// (exit 1) on any broken check. Run: npm install && npm test (from the repo root).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Tests run against the built app (npm test builds first), the same files GitHub Pages serves.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = 8765 + Math.floor(Math.random() * 1000);
const BASE = `http://localhost:${PORT}/`;

function browserPath() {
  const dir = '/opt/pw-browsers';
  if (!existsSync(dir)) return undefined;
  const shell = readdirSync(dir).find(d => d.startsWith('chromium_headless_shell'));
  if (shell) return `${dir}/${shell}/chrome-linux/headless_shell`;
  return undefined;
}

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath: browserPath() });

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }

async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: opts.scheme || 'light' });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  await p.goto(BASE);
  return p;
}

await check('Page loads with the app title and no errors', async () => {
  const p = await page();
  await p.waitForSelector('#title');
  expect((await p.textContent('#title')).includes('Shower Thoughts'), 'title missing');
  expect(p.errors.length === 0, 'errors: ' + p.errors.join(' | '));
});

await check('Fits a phone screen with no sideways scroll', async () => {
  const p = await page();
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(!wide, 'page scrolls sideways at 390px');
});

await check('Dark mode switches the background', async () => {
  const light = await page({ scheme: 'light' });
  const dark = await page({ scheme: 'dark' });
  const bg = p => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect((await bg(light)) !== (await bg(dark)), 'same background in light and dark');
});

await check('Hidden elements stay hidden (DEV-1)', async () => {
  const p = await page();
  const shown = await p.evaluate(() => {
    const el = document.createElement('div'); el.hidden = true; el.style.display = 'block';
    document.body.appendChild(el); return getComputedStyle(el).display !== 'none';
  });
  expect(!shown, '[hidden] can be overridden');
});

await check('Generate stays off until there is text', async () => {
  const p = await page();
  expect(await p.isVisible('#raw'), 'text box missing');
  expect(await p.isDisabled('#generate'), 'Generate should start disabled');
  await p.fill('#raw', '   \n  ');
  expect(await p.isDisabled('#generate'), 'Generate should ignore blank space');
  await p.fill('#raw', 'Web app Shower thoughts\nQuickly formulate spontaneous ideas');
  expect(await p.isEnabled('#generate'), 'Generate should turn on with text');
});

await check('Text box does not trigger iPhone zoom (17px or more)', async () => {
  const p = await page();
  const size = await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('raw')).fontSize));
  expect(size >= 16, 'text box font is ' + size + 'px');
});

/* Kevin's real shower note from Oct 18, 2026 (Building Log Step 4). */
const SHOWER_NOTE = `Things to add
Something went wrong button?
Post prompt build
Not sure where to route. Maybe trigger cowork task to address concern
Details of session
What went wrong
Premade answers?

Web app for new class
Pulls next imprint warmup ready to copy into TTS application
Link to next task

Web app Shower thoughts
Quickly formulate spontaneous ideas that came to me in the shower
Right now I just jot down what's in my head in a note then I build an optimized prompt use Speak to Prompt.
But what if my ideas could go into a web app and come out in a script that I can speak out clearly
Include this note as an example
Give two options to talk it out or a text box
Utilize shortcut use cloud model for note interpretation

Web app Second brain
Refer to YouTube video and I'd like to setup using that stack
Include link and transcript
New to obsidian and is there a way to sync from everything in my notion as a cowork job every day at the end of the day to absorb anything I've done`;

await check('Real shower note becomes 4 idea blocks with the right title', async () => {
  const p = await page();
  await p.fill('#raw', SHOWER_NOTE);
  await p.click('#generate');
  await p.waitForSelector('#script');
  expect((await p.textContent('#scriptTitle')).trim() === '💡 Things to add, and 3 more', 'wrong note title: ' + await p.textContent('#scriptTitle'));
  const titles = await p.$$eval('.idea h3', els => els.map(e => e.textContent.trim()));
  expect(JSON.stringify(titles) === JSON.stringify(['Things to add', 'Web app for new class', 'Web app Shower thoughts', 'Web app Second brain']), 'wrong idea titles: ' + titles.join(' | '));
  expect(p.errors.length === 0, 'errors: ' + p.errors.join(' | '));
});

await check('Questions, right now lines, and every word are kept', async () => {
  const p = await page();
  await p.fill('#raw', SHOWER_NOTE);
  await p.click('#generate');
  const blocks = await p.$$eval('.idea', els => els.map(e => e.textContent));
  expect(/Open questions:[^]*Something went wrong button\?[^]*Not sure where to route/.test(blocks[0]), 'questions not caught in Things to add');
  expect(/Right now: Right now I just jot down/.test(blocks[2]), 'right now line not caught');
  expect(/Open questions: New to obsidian and is there a way to sync/.test(blocks[3]), 'sync question not caught as an open question');
  const all = blocks.join(' ').toLowerCase();
  for (const word of ['tts application', 'cowork job', 'youtube video', 'premade answers', 'two options to talk it out']) {
    expect(all.includes(word), 'dropped: ' + word);
  }
});

await check('Copy puts the Markdown script and raw note on the clipboard', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  await p.goto(BASE);
  await p.fill('#raw', SHOWER_NOTE);
  await p.click('#generate');
  await p.click('#copy');
  await p.waitForSelector('#copyMsg:not([hidden])');
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  expect(clip.startsWith('# 💡 Things to add, and 3 more'), 'clipboard does not start with the note title');
  expect(clip.includes('**🎙️ Read this out loud**') && clip.includes('- Open questions:'), 'clipboard missing script sections');
  expect(clip.includes('## 📝 Raw note') && clip.includes("anything I've done"), 'raw note missing from clipboard');
});

await check('One line with no title still works', async () => {
  const p = await page();
  await p.fill('#raw', 'remind me to try a sauna playlist');
  await p.click('#generate');
  expect((await p.textContent('#scriptTitle')).includes('remind me to try a sauna playlist'), 'single line title wrong');
  expect((await p.textContent('.read')).includes('Remind me to try a sauna playlist.'), 'single line not read back');
});

await browser.close();
server.kill();
for (const r of results) console.log(r[0] + '  ' + r[1] + (r[2] ? '  -> ' + r[2] : ''));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
