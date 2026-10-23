/* Which copy of the app this is. vite.config.js fills these in at build time:
   the version comes from package.json, and STAGING is true only for the build
   that lives at /shower-thoughts/staging/.

   Live and staging share one web address (kmagno94.github.io), so they share
   browser storage too. Anything saved in the browser must go through
   storageKey(), which puts "stg:" in front on staging, so testing never
   touches real saved data. */
export const VERSION = 'v' + __APP_VERSION__;
export const STAGING = __STAGING__;
export const storageKey = (key) => (STAGING ? 'stg:' : '') + key;
