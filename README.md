# Shower Thoughts 💡

Raw shower ideas in, read-aloud scripts out, saved to Apple Notes. A personal tool that feeds Speak to Prompt.

**Live:** https://kmagno94.github.io/shower-thoughts/

## Status

Being built one small step at a time. Right now the page is an empty shell that proves the deploy works.

## Stack

Same as Speak to Prompt: Svelte 5 + Vite, app source in `app/`, built for iPhone Safari (`safari16`), deployed to GitHub Pages by GitHub Actions. Smoke tests run first, and a failing test stops the deploy.

## Develop

```
npm install
npm run dev     # local server
npm test        # build, then run the smoke tests at phone size
```

One-time setup (done): repo Settings > Pages > Source: GitHub Actions.
