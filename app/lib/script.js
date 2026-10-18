/* No-key script builder. Turns a raw shower note into the Step 4 format:
   one note per save, one block per idea, raw note kept at the bottom.
   It only rearranges what you wrote: no new facts, nothing dropped. */

const QUESTION = /\?\s*$|^(maybe|which|how do|how would|could i|do i)\b|\b(not sure|is there a way|what if|should i|i wonder)\b/i;
const RIGHT_NOW = /^(right now|currently|today i|at the moment|for now)\b/i;

function cleanLine(line) {
  return line.replace(/^\s*([-*•◦]|\d+[.)])\s+/, '').replace(/\s+/g, ' ').trim();
}

function sentence(line) {
  const s = line.charAt(0).toUpperCase() + line.slice(1);
  return /[.!?]["')\]]?$/.test(s) ? s : s + '.';
}

/* Blank lines separate ideas; the first line of each block is its title. */
export function splitIdeas(raw) {
  const blocks = raw.replace(/\r\n?/g, '\n').split(/\n\s*\n+/);
  const ideas = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(cleanLine).filter(Boolean);
    if (!lines.length) continue;
    if (lines.length === 1) {
      const only = lines[0];
      const title = only.length > 60 ? only.slice(0, 57).trimEnd() + '...' : only;
      ideas.push({ title, lines: [only] });
    } else {
      ideas.push({ title: lines[0], lines: lines.slice(1) });
    }
  }
  return ideas;
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
  const ideas = splitIdeas(raw);
  if (!ideas.length) return null;
  const more = ideas.length - 1;
  const title = '💡 ' + ideas[0].title + (more ? `, and ${more} more` : '');
  const blocks = ideas.map(idea => ({
    title: idea.title,
    readAloud: [`This one is called ${idea.title.replace(/[.!?]+$/, '')}.`, ...idea.lines.map(sentence)].join(' '),
    skeleton: skeleton(idea)
  }));
  const rawNote = raw.replace(/\r\n?/g, '\n').trim();

  const md = [`# ${title}`, ''];
  for (const b of blocks) {
    md.push(`## ${b.title}`, '', '**🎙️ Read this out loud**', b.readAloud, '', '**🧩 Skeleton**');
    for (const [label, value] of b.skeleton) md.push(`- ${label}: ${value}`);
    md.push('');
  }
  md.push('---', '', '## 📝 Raw note', '', rawNote);

  return { title, blocks, rawNote, markdown: md.join('\n') };
}
