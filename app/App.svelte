<script>
  import { buildScript, CUE } from './lib/script.js';

  let raw = $state('');
  let script = $state(null);
  let copyMsg = $state('');
  const ready = $derived(raw.trim().length > 0);

  function generate() {
    if (!ready) return;
    script = buildScript(raw);
    copyMsg = '';
  }

  /* Clipboard first; older iPhones fall back to selecting a hidden text box. */
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    try {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy'); t.remove();
      return ok;
    } catch (e) { return false; }
  }

  /* Copy is only for computers that can't run Shortcuts (Step 20). */
  async function copy() {
    if (!script) return;
    copyMsg = (await copyText(script.markdown)) ? 'Copied. Paste it anywhere.' : "Couldn't copy here. Press and hold the script to select it.";
  }

  /* Save to Notes (Building Log Step 14): copy the script, then run the Save
     Shower Thought shortcut with input=clipboard, so the script never rides in
     the link (DEV-3). The shortcut only saves text containing "Read this out loud". */
  const SAVE_SHORTCUT = 'Save Shower Thought';
  const saveHref = 'shortcuts://run-shortcut?name=' + encodeURIComponent(SAVE_SHORTCUT) + '&input=clipboard';
  let saveLink;

  async function save() {
    if (!script) return;
    if (!(await copyText(script.markdown))) {
      copyMsg = "Couldn't hand the script to Shortcuts, so nothing was saved. Tap Save to Notes again.";
      return;
    }
    saveLink.click();
    copyMsg = 'Sent to your Save Shower Thought shortcut. Look for the "Saved to Shower Thoughts \ud83d\udca1" notification. Nothing happened? The shortcut name must be exactly Save Shower Thought.';
  }

  /* Talk it out runs Kevin's Shower Thoughts shortcut, a copy of the Speak to
     Prompt shortcut that comes back here (Building Log Step 12). The name must
     match exactly (DEV-13). The transcript comes back on the clipboard (DEV-3). */
  const SHORTCUT = 'Shower Thoughts';
  const talkHref = 'shortcuts://run-shortcut?name=' + encodeURIComponent(SHORTCUT);
  const PLACEHOLDER = 'Speak to Prompt: waiting for your transcript';

  /* The shortcut needs an iPhone or iPad, so computers just get the text box. */
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
  const appleTouch = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  /* Save to Notes works anywhere Shortcuts and Notes do: iPhone, iPad, and Mac. */
  const apple = appleTouch || /Macintosh/.test(ua);

  let pasteMode = $state(false);
  let pasteMsg = $state('');

  /* #paste: the shortcut is back with a fresh transcript on the clipboard.
     Listen for hashchange and pageshow too, not just page load (DEV-4). */
  function checkHash() {
    if (location.hash === '#paste') { pasteMode = true; pasteMsg = ''; }
  }
  $effect(() => {
    checkHash();
    const onShow = e => { if (e.persisted) checkHash(); };
    window.addEventListener('hashchange', checkHash);
    window.addEventListener('pageshow', onShow);
    return () => { window.removeEventListener('hashchange', checkHash); window.removeEventListener('pageshow', onShow); };
  });

  async function pasteTranscript() {
    let text = '';
    try { text = (await navigator.clipboard.readText()).trim(); }
    catch (e) { pasteMsg = "Couldn't read the clipboard. Press and hold in the box and tap Paste."; return; }
    if (!text) { pasteMsg = 'The clipboard is empty. In Voice Memos, choose Copy Transcript first.'; return; }
    if (text === PLACEHOLDER) { pasteMsg = "That's the shortcut's placeholder, not your transcript. In Voice Memos, choose Copy Transcript first."; return; }
    raw = text;
    script = null;
    pasteMode = false;
    history.replaceState(null, '', location.pathname + location.search);
  }
</script>

<main class="wrap">
  <h1 id="title">Shower Thoughts <span aria-hidden="true">💡</span></h1>
  <p class="sub">Raw ideas in, read-aloud scripts out.</p>

  {#if pasteMode}
    <section id="pasteWrap" class="card banner" aria-live="polite">
      <p class="label">Back from Voice Memos</p>
      <button id="paste" class="primary" type="button" onclick={pasteTranscript}>📋 Tap to paste your transcript</button>
      <p id="pasteMsg" class="note" hidden={!pasteMsg}>{pasteMsg}</p>
    </section>
  {/if}

  <section class="card">
    {#if appleTouch}
      <div id="voiceRow" class="voice">
        <a id="talkLink" class="secondary" href={talkHref}>🎙️ Talk it out</a>
        <p class="hint">Record in Voice Memos, copy the transcript, and it brings you back here to paste.</p>
      </div>
    {/if}
    <label class="label" for="raw">What's on your mind?</label>
    <textarea
      id="raw"
      bind:value={raw}
      rows="9"
      placeholder="One idea at a time. Start with a short title, then dump the rest. Messy is fine."
      autocomplete="off"
      autocapitalize="sentences"
      spellcheck="true"></textarea>
    <button id="generate" class="primary" type="button" disabled={!ready} onclick={generate}>Generate script</button>
  </section>

  {#if script}
    <section id="script" class="card script" aria-live="polite">
      <h2 id="scriptTitle">{script.title}</h2>
      <p class="hint">Quick version: it sorts your own lines into talking points. Shorter, smarter points come with the Gemini upgrade.</p>

      <article class="idea">
        <p class="tag">🎙️ Talking points</p>
        <p class="cue">{CUE}</p>
        <ol class="points">
          {#each script.points as [label, items]}
            <li>
              <b>{label}</b>
              <ul>
                {#each items as item}<li>{item}</li>{/each}
              </ul>
            </li>
          {/each}
        </ol>
      </article>

      <details class="rawbox">
        <summary>📝 Raw note (kept at the bottom of the note)</summary>
        <p class="raw">{script.rawNote}</p>
      </details>

      {#if apple}
        <button id="save" class="primary" type="button" onclick={save}>💾 Save to Notes</button>
        <a id="saveLink" href={saveHref} bind:this={saveLink} hidden aria-hidden="true" tabindex="-1">Save Shower Thought</a>
      {:else}
        <button id="copy" class="primary" type="button" onclick={copy}>Copy script</button>
      {/if}
      <p id="copyMsg" class="note" hidden={!copyMsg} aria-live="polite">{copyMsg}</p>
    </section>
  {/if}
</main>
