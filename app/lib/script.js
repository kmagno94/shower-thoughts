/* No-key script builder. One idea per script (Kevin's call, Building Log Step 9):
   the whole box is one idea, the first line is its title, and blank lines are
   just paragraphs. It only rearranges what you wrote: no new facts, nothing dropped. */

const QUESTION = /\?\s*$|^(maybe|which|how do|how would|could i|do i)\b|\b(not sure|is there a way|what if|should i|i wonder)\b/i;
const RIGHT_NOW = /^(right now|currently|today i|at the moment|for now)\b/i;

function cleanLine(line) {
  return line.replace(/^\s*([-*•◦]|\d+[.)])\s+/, '').replace(/\s+/g, ' ').trim();
}

function sentence(line) {
  const s = line.charAt(0).toUpperCase() + line.slice(1);
  return /[.!?]["')\]]?$/.test(s) ? s : s + '.';
}

/* The first line is the title. A single line is both the title and the idea. */
export function readIdea(raw) {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map(cleanLine).filter(Boolean);
  if (!lines.length) return null;
  if (lines.length === 1) {
    const only = lines[0];
    return { title: only.length > 60 ? only.slice(0, 57).trimEnd() + '...' : only, lines: [only] };
  }
  return { title: lines[0], lines: lines.slice(1) };
}

function skeleton(idea) {
  const now = [], want = [], open = [];
  for (const line of idea.lines) {
    if (RIGHT_NOW.test(line)) now.push(line);
    else if (QUESTION.test(line)) open.push(line);
    else want.push(line);
  }
  const join = list => (list.length ? list.join('; ') : 'None noted');
  return [
    ['What it is', idea.title],
    ['Right now', join(now)],
    ['What I want', join(want)],
    ['Open questions', join(open)]
  ];
}

/* Returns the script as data (for the page) and as Markdown (for copying and Apple Notes). */
export function buildScript(raw) {
  const idea = readIdea(raw);
  if (!idea) return null;
  const title = '💡 ' + idea.title;
  const readAloud = [`This one is called ${idea.title.replace(/[.!?]+$/, '')}.`, ...idea.lines.map(sentence)].join(' ');
  const parts = skeleton(idea);
  const rawNote = raw.replace(/\r\n?/g, '\n').trim();

  const md = [`# ${title}`, '', '**🎙️ Read this out loud**', readAloud, '', '**🧩 Skeleton**'];
  for (const [label, value] of parts) md.push(`- ${label}: ${value}`);
  md.push('', '---', '', '## 📝 Raw note', '', rawNote);

  return { title, readAloud, skeleton: parts, rawNote, markdown: md.join('\n') };
}
