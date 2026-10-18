<script>
  let raw = $state('');
  let note = $state('');
  const ready = $derived(raw.trim().length > 0);

  function generate() {
    if (!ready) return;
    // The script builder arrives in the next step. For now, confirm the tap landed.
    note = 'Got it. The script builder arrives in the next update.';
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
      oninput={() => (note = '')}
      rows="9"
      placeholder="Dump it here, messy is fine. Put a blank line between ideas and start each one with a short title."
      autocomplete="off"
      autocapitalize="sentences"
      spellcheck="true"></textarea>
    <button id="generate" class="primary" type="button" disabled={!ready} onclick={generate}>Generate script</button>
    <p id="note" class="note" hidden={!note} aria-live="polite">{note}</p>
  </section>
</main>
