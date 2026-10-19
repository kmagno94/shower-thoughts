<script>
  import { buildScript } from './lib/script.js';

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
  async function copy() {
    if (!script) return;
    const text = script.markdown;
    try {
      await navigator.clipboard.writeText(text);
      copyMsg = 'Copied. Paste it anywhere.';
      return;
    } catch (e) {}
    try {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy'); t.remove();
      copyMsg = ok ? 'Copied. Paste it anywhere.' : "Couldn't copy here. Press and hold the script to select it.";
    } catch (e) {
      copyMsg = "Couldn't copy here. Press and hold the script to select it.";
    }
  }
</script>

<main class="wrap">
  <h1 id="title">Shower Thoughts <span aria-hidden="true">💡</span></h1>
  <p class="sub">Raw ideas in, read-aloud scripts out.</p>

  <section class="card">
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
      <p class="hint">Quick version: it tidies your words into the layout. Real reorganizing comes with the Gemini upgrade.</p>

      <article class="idea">
        <p class="tag">🎙️ Read this out loud</p>
        <p class="read">{script.readAloud}</p>
        <p class="tag">🧩 Skeleton</p>
        <ul class="skel">
          {#each script.skeleton as [label, value]}
            <li><b>{label}:</b> {value}</li>
          {/each}
        </ul>
      </article>

      <details class="rawbox">
        <summary>📝 Raw note (kept at the bottom of the note)</summary>
        <p class="raw">{script.rawNote}</p>
      </details>

      <button id="copy" class="primary" type="button" onclick={copy}>Copy script</button>
      <p id="copyMsg" class="note" hidden={!copyMsg} aria-live="polite">{copyMsg}</p>
    </section>
  {/if}
</main>
