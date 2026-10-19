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

/* One idea from Kevin's real shower note, Oct 18, 2026 (Building Log Step 4). */
const SHOWER_IDEA = `Web app Shower thoughts
Quickly formulate spontaneous ideas that came to me in the shower
Right now I just jot down what's in my head in a note then I build an optimized prompt use Speak to Prompt.
But what if my ideas could go into a web app and come out in a script that I can speak out clearly
Include this note as an example
Give two options to talk it out or a text box
Utilize shortcut use cloud model for note interpretation`;

await check('One idea makes one script with its title (Step 9)', async () => {
  const p = await page();
  await p.fill('#raw', SHOWER_IDEA);
  await p.click('#generate');
  await p.waitForSelector('#script');
  expect((await p.textContent('#scriptTitle')).trim() === '\ud83d\udca1 Web app Shower thoughts', 'wrong title: ' + await p.textContent('#scriptTitle'));
  expect((await p.$$('.idea')).length === 1, 'should be exactly one idea block');
  expect(p.errors.length === 0, 'errors: ' + p.errors.join(' | '));
});

await check('Blank lines stay inside the same idea', async () => {
  const p = await page();
  await p.fill('#raw', 'Web app for new class\nPulls next imprint warmup ready to copy into TTS application\n\nLink to next task');
  await p.click('#generate');
  expect((await p.$$('.idea')).length === 1, 'blank line split the idea');
  expect((await p.textContent('#scriptTitle')).includes('Web app for new class'), 'title wrong');
  expect((await p.textContent('.points')).includes('Link to next task'), 'line after the blank line was dropped');
});

/* Talking points as [label, items] in the order shown (Step 19). */
const groups = p => p.$$eval('.points > li', els => els.map(li => [li.querySelector('b').textContent.trim(), [...li.querySelectorAll('ul li')].map(x => x.textContent.trim())]));

await check('Talking points come in speaking order with every word kept (Step 19)', async () => {
  const p = await page();
  await p.fill('#raw', SHOWER_IDEA);
  await p.click('#generate');
  const g = await groups(p);
  expect(JSON.stringify(g.map(x => x[0])) === JSON.stringify(['The idea', 'Right now', 'What I want', 'Ask about']), 'wrong order: ' + g.map(x => x[0]).join(' | '));
  expect(g[0][1][0] === 'Web app Shower thoughts', 'idea point wrong: ' + g[0][1][0]);
  expect(g[1][1][0].startsWith('Right now I just jot down'), 'right now line not caught');
  expect(g[3][1][0].startsWith('But what if my ideas could go into a web app'), 'what if line not under Ask about');
  expect(g.every(x => x[1].every(i => !/\.$/.test(i))), 'talking points should not end in a period');
  expect(!(await p.$('.read')), 'the big read-aloud paragraph should be gone');
  const all = g.flatMap(x => x[1]).join(' ').toLowerCase();
  for (const word of ['spontaneous ideas', 'speak to prompt', 'include this note as an example', 'two options to talk it out', 'cloud model']) {
    expect(all.includes(word), 'dropped: ' + word);
  }
});

await check('Questions land under Ask about and empty groups are skipped', async () => {
  const p = await page();
  await p.fill('#raw', 'Things to add\nSomething went wrong button?\nNot sure where to route. Maybe trigger cowork task');
  await p.click('#generate');
  const g = await groups(p);
  expect(JSON.stringify(g.map(x => x[0])) === JSON.stringify(['The idea', 'Ask about']), 'wrong groups: ' + g.map(x => x[0]).join(' | '));
  expect(g[1][1][0] === 'Something went wrong button?' && g[1][1][1].startsWith('Not sure where to route'), 'questions not caught');
});

await check('Copy (computers without Shortcuts) puts the Markdown script and raw note on the clipboard', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  await p.goto(BASE);
  await p.fill('#raw', SHOWER_IDEA);
  await p.click('#generate');
  await p.click('#copy');
  await p.waitForSelector('#copyMsg:not([hidden])');
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  expect(clip.startsWith('# \ud83d\udca1 Web app Shower thoughts'), 'clipboard does not start with the note title');
  expect(clip.includes('## \ud83c\udf99\ufe0f Talking points') && clip.includes('**1. The idea**') && clip.includes('**4. Ask about**'), 'clipboard missing talking points');
  expect(clip.includes('## \ud83d\udcdd Raw note') && clip.includes('Utilize shortcut use cloud model'), 'raw note missing from clipboard');
});

await check('One line with no title still works', async () => {
  const p = await page();
  await p.fill('#raw', 'remind me to try a sauna playlist');
  await p.click('#generate');
  expect((await p.textContent('#scriptTitle')).includes('remind me to try a sauna playlist'), 'single line title wrong');
  expect((await p.textContent('.points')).includes('Remind me to try a sauna playlist'), 'single line not in talking points');
});

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
async function clipPage(hash = '', ua) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'], ...(ua ? { userAgent: ua } : {}) });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  await p.goto(BASE + hash);
  return p;
}

await check('Talk it out runs the Shower Thoughts shortcut', async () => {
  const p = await clipPage('', IPHONE);
  expect(await p.isVisible('#talkLink'), 'Talk it out missing on iPhone');
  const href = await p.getAttribute('#talkLink', 'href');
  expect(href === 'shortcuts://run-shortcut?name=Shower%20Thoughts', 'wrong link: ' + href);
});

await check('Computers get just the text box (no Talk it out)', async () => {
  const p = await page();
  expect(!(await p.$('#talkLink')), 'Talk it out should not show on a computer');
});

await check('#paste shows one big paste button that fills the box', async () => {
  const p = await clipPage('#paste', IPHONE);
  await p.waitForSelector('#pasteWrap');
  await p.evaluate(() => navigator.clipboard.writeText('Web app Shower thoughts\nGive two options to talk it out or a text box'));
  await p.click('#paste');
  await p.waitForSelector('#pasteWrap', { state: 'detached', timeout: 3000 }).catch(() => {});
  expect((await p.inputValue('#raw')).startsWith('Web app Shower thoughts'), 'transcript not pasted into the box');
  expect(!(await p.$('#pasteWrap')), 'banner should close after pasting');
  expect(!(await p.evaluate(() => location.hash)), '#paste should be cleared');
  expect(await p.isEnabled('#generate'), 'Generate should be ready after pasting');
});

await check('Paste rejects the shortcut placeholder (DEV-13)', async () => {
  const p = await clipPage('#paste', IPHONE);
  await p.evaluate(() => navigator.clipboard.writeText('Speak to Prompt: waiting for your transcript'));
  await p.click('#paste');
  await p.waitForSelector('#pasteMsg:not([hidden])', { timeout: 3000 }).catch(() => {});
  expect(await p.isVisible('#pasteMsg'), 'no warning for the placeholder: ' + await p.textContent('#pasteMsg'));
  expect((await p.inputValue('#raw')) === '', 'placeholder should not fill the box');
});

await check('#paste also works when the page is already open (hashchange, DEV-4)', async () => {
  const p = await clipPage('', IPHONE);
  expect(!(await p.$('#pasteWrap')), 'banner should not show without #paste');
  await p.evaluate(() => { location.hash = '#paste'; });
  await p.waitForSelector('#pasteWrap', { timeout: 2000 });
  expect(p.errors.length === 0, 'errors: ' + p.errors.join(' | '));
});

await check('Save to Notes copies the script and runs Save Shower Thought with the clipboard', async () => {
  const p = await clipPage('', IPHONE);
  await p.fill('#raw', SHOWER_IDEA);
  await p.click('#generate');
  expect(await p.isVisible('#save'), 'Save to Notes missing on iPhone');
  const href = await p.getAttribute('#saveLink', 'href');
  expect(href === 'shortcuts://run-shortcut?name=Save%20Shower%20Thought&input=clipboard', 'wrong save link: ' + href);
  expect(!/text=/.test(href), 'script must not ride in the link (DEV-3)');
  await p.evaluate(() => { const a = document.getElementById('saveLink'); a.addEventListener('click', e => { e.preventDefault(); window.__opened = a.href; }); });
  await p.click('#save');
  await p.waitForFunction(() => window.__opened, null, { timeout: 3000 });
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  expect(clip.startsWith('# \ud83d\udca1 Web app Shower thoughts') && clip.includes('Talking points'), 'clipboard does not hold the script');
  expect(await p.isVisible('#copyMsg'), 'no message after saving');
  expect(p.errors.length === 0, 'errors: ' + p.errors.join(' | '));
});

await check('Mac also gets Save to Notes; other computers just get Copy', async () => {
  const mac = await clipPage('', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15');
  await mac.fill('#raw', SHOWER_IDEA); await mac.click('#generate');
  expect(await mac.isVisible('#save'), 'Save to Notes missing on Mac');
  const other = await page();
  await other.fill('#raw', SHOWER_IDEA); await other.click('#generate');
  expect(!(await other.$('#save')) && await other.isVisible('#copy'), 'non-Apple computer should only get Copy');
});

await check('iPhone shows only Save to Notes, no Copy script (Step 20)', async () => {
  const p = await clipPage('', IPHONE);
  await p.fill('#raw', SHOWER_IDEA); await p.click('#generate');
  expect(await p.isVisible('#save'), 'Save to Notes missing');
  expect(!(await p.$('#copy')), 'Copy script should be gone on iPhone');
});

await check('Saved note still passes the Save Shower Thought check (Read this out loud)', async () => {
  const p = await clipPage('', IPHONE);
  await p.fill('#raw', SHOWER_IDEA); await p.click('#generate');
  await p.evaluate(() => { const a = document.getElementById('saveLink'); a.addEventListener('click', e => { e.preventDefault(); window.__opened = 1; }); });
  await p.click('#save');
  await p.waitForFunction(() => window.__opened, null, { timeout: 3000 });
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  expect(clip.includes('Read this out loud'), 'the shortcut would refuse this note: Read this out loud is missing');
  expect(clip.includes('## \ud83c\udf99\ufe0f Talking points'), 'Talking points heading missing');
});

await browser.close();
server.kill();
for (const r of results) console.log(r[0] + '  ' + r[1] + (r[2] ? '  -> ' + r[2] : ''));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
