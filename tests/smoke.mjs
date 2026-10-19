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
  expect((await p.textContent('.read')).includes('Link to next task.'), 'line after the blank line was dropped');
});

await check('Questions, right now lines, and every word are kept', async () => {
  const p = await page();
  await p.fill('#raw', SHOWER_IDEA);
  await p.click('#generate');
  const text = await p.textContent('.idea');
  expect(/Right now: Right now I just jot down/.test(text), 'right now line not caught');
  expect(/Open questions: But what if my ideas could go into a web app/.test(text), 'what if line not caught as a question');
  const all = text.toLowerCase();
  for (const word of ['spontaneous ideas', 'speak to prompt', 'include this note as an example', 'two options to talk it out', 'cloud model']) {
    expect(all.includes(word), 'dropped: ' + word);
  }
  await p.fill('#raw', 'Things to add\nSomething went wrong button?\nNot sure where to route. Maybe trigger cowork task');
  await p.click('#generate');
  expect(/Open questions: Something went wrong button\?; Not sure where to route/.test(await p.textContent('.idea')), 'questions not caught');
});

await check('Copy puts the Markdown script and raw note on the clipboard', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  await p.goto(BASE);
  await p.fill('#raw', SHOWER_IDEA);
  await p.click('#generate');
  await p.click('#copy');
  await p.waitForSelector('#copyMsg:not([hidden])');
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  expect(clip.startsWith('# \ud83d\udca1 Web app Shower thoughts'), 'clipboard does not start with the note title');
  expect(clip.includes('**\ud83c\udf99\ufe0f Read this out loud**') && clip.includes('- Open questions:'), 'clipboard missing script sections');
  expect(clip.includes('## \ud83d\udcdd Raw note') && clip.includes('Utilize shortcut use cloud model'), 'raw note missing from clipboard');
});

await check('One line with no title still works', async () => {
  const p = await page();
  await p.fill('#raw', 'remind me to try a sauna playlist');
  await p.click('#generate');
  expect((await p.textContent('#scriptTitle')).includes('remind me to try a sauna playlist'), 'single line title wrong');
  expect((await p.textContent('.read')).includes('Remind me to try a sauna playlist.'), 'single line not read back');
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

await check('Talk it out runs the Speak to Prompt shortcut with the return flag', async () => {
  const p = await clipPage('', IPHONE);
  expect(await p.isVisible('#talkLink'), 'Talk it out missing on iPhone');
  const href = await p.getAttribute('#talkLink', 'href');
  expect(href === 'shortcuts://run-shortcut?name=Speak%20to%20Prompt&input=text&text=shower-thoughts', 'wrong link: ' + href);
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

await browser.close();
server.kill();
for (const r of results) console.log(r[0] + '  ' + r[1] + (r[2] ? '  -> ' + r[2] : ''));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
