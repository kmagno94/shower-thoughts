/* No-key script builder. One idea per script (Step 9), written as talking points
   in speaking order (Step 19): the idea, how it works right now, what I want,
   then what to ask about. It only rearranges what you wrote: no new facts,
   nothing dropped. The note keeps the raw idea at the bottom. */

const QUESTION = /\?\s*$|^(maybe|which|how do|how would|could i|do i)\b|\b(not sure|is there a way|what if|should i|i wonder)\b/i;
const RIGHT_NOW = /^(right now|currently|today i|at the moment|for now)\b/i;

/* The Save Shower Thought shortcut only saves notes that contain this heading. */
export const MARKER = 'Talking points';

function cleanLine(line) {
  return line.replace(/^\s*([-*•◦]|\d+[.)])\s+/, '').replace(/\s+/g, ' ').trim();
}

/* A talking point is the line itself, first letter capitalized, without a trailing period. */
function point(line) {
  const s = line.charAt(0).toUpperCase() + line.slice(1);
  return s.replace(/\.+$/, '');
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

/* Groups in the order you'd say them. Empty groups are left out. */
function talkingPoints(idea) {
  const now = [], want = [], ask = [];
  for (const line of idea.lines) {
    if (RIGHT_NOW.test(line)) now.push(point(line));
    else if (QUESTION.test(line)) ask.push(point(line));
    else want.push(point(line));
  }
  const groups = [['The idea', [point(idea.title)]]];
  if (now.length) groups.push(['Right now', now]);
  if (want.length) groups.push(['What I want', want]);
  if (ask.length) groups.push(['Ask about', ask]);
  return groups;
}

/* Returns the script as data (for the page) and as Markdown (for Apple Notes). */
export function buildScript(raw) {
  const idea = readIdea(raw);
  if (!idea) return null;
  const title = '💡 ' + idea.title;
  const points = talkingPoints(idea);
  const rawNote = raw.replace(/\r\n?/g, '\n').trim();

  const md = [`# ${title}`, '', `## 🎙️ ${MARKER}`, ''];
  points.forEach(([label, items], i) => {
    md.push(`**${i + 1}. ${label}**`);
    for (const item of items) md.push(`- ${item}`);
    md.push('');
  });
  md.push('---', '', '## 📝 Raw note', '', rawNote);

  return { title, points, rawNote, markdown: md.join('\n') };
}
