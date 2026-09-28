# OnHockey Clean

Two ways to browse **onhockey.tv** without the junk ads, popunders and
tab-hijacking redirects. Both run only in your own browser and leave the
site's own content (schedule, player, chat) as it is.

## Option A: uBlock Origin filter list (recommended)

1. Install [uBlock Origin](https://ublockorigin.com/).
2. Open its dashboard → **Filter lists** → **Import** at the bottom.
3. Paste the raw URL of `onhockey-clean.ublock.txt` (or paste its contents
   into **My filters**) → **Apply changes**.

uBlock also blocks ad requests inside the stream player iframes, which a
userscript can't reach because they load from other domains.

## Option B: userscript

1. Install [Violentmonkey](https://violentmonkey.github.io/) or Tampermonkey.
2. Open `onhockey-clean.user.js` (raw) and click **Install**.

What it does:

- blocks `window.open` popups and popunders
- reloads each onhockey.tv page with the `everyoneconsole.com` ad loader
  (and a few other common popunder networks) stripped out, so the ad code
  never runs; if that fails it falls back to the normal page
- swallows clicks that would redirect the tab to an ad host
- hides empty ad slots, drops the background image, and makes the layout
  reflow on narrow screens

Best result: use both.

## Adding new ad hosts

When the site switches ad network, add the new domain to `AD_HOSTS` in the
userscript and a `||domain.com^$3p` line to the filter list.
