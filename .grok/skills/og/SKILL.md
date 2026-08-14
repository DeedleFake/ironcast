---
name: og
description: >
  Share-link previews for apps on *.grok.me. Use when scaffolding, renaming,
  or changing what the app is called — and for share / unfurl / OG / Twitter
  card questions. Triggers on "share", "rename", "app name", "OG", "Open Graph",
  "twitter card", "unfurl", "og:image", "link preview", "social card",
  "thumbnail", "preview image", "SEO", "meta description".
metadata:
  short-description: "Share cards: og:image in root head → og.grok.me"
---

# Share cards

A deployed app (`https://{name}.grok.me`) unfurls with a 1200×630 card from
`og.grok.me`. The app only sets meta tags — **no image route, no renderer**.

## Keep `og:image` in the root head

AGENTS.md § "First scaffold" is the source of truth for `src/routes/__root.tsx`.
It sets `APP_NAME` (tab title + card text) and:

```
https://og.grok.me/v1/card.png?host={VITE_PUBLIC_HOSTNAME}&title={APP_NAME}
```

plus `og:image:width` / `og:image:height` of `1200` / `630`.

**Extend `__root.tsx`; never replace it wholesale** (auth SSR, redesign, another
skill excerpt). Dropping `og:image` ships with no card; `npm run dev` / `build`
will not catch that.

When the user renames the app, update `APP_NAME` — that is both the document
title and the painted card title.

## Preview vs deploy

- **Live preview:** no `VITE_PUBLIC_HOSTNAME` → no `og:image`. Expected.
- **Publish:** platform injects the hostname. Do **not** write a `.env`.
- Card pixels update on the **next deploy** (URL is baked into HTML at build).

## Not supported

One site-wide card from the app name. No custom image, screenshot, per-route
card, or runtime `og:*`. Do not scaffold `/api/og` or add an image renderer.

If you add `robots.txt`, never blanket `Disallow: /` — crawlers must fetch `/`
to read the tags.
