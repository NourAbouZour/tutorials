# Guides site

A one-page site where people from your reels find the PDF guide for the word they commented.

## Admin panel: switch guides on and off

Open **https://nourabouzour.github.io/tutorials/admin.html** (it isn't linked from the site).

- Every guide is listed with its status: **Draft** (not on the site) or **Live**.
- Read the title, description and PDF (open it or preview it right there).
- Paste the Instagram reel link and press **Activate** to put a guide live. It shows on the site about a minute later.
- **Take off the site** hides a guide again. You can edit titles, descriptions and dates too.

The first time on each device, connect it with a GitHub fine-grained token
(only the `tutorials` repo, permission **Contents: Read and write**). The page explains how.
The token is stored only in that browser.

All content lives in `guides.json`. New guides are added there as drafts (`"active": false`).

## Sending someone straight to one guide

Add `?word=` to the end of your site link:

```
https://nourabouzour.github.io/tutorials/?word=BUDGET
```

It opens with the search already filled in, so they see only that guide.
You can also tap the small link icon on any card to copy that exact link.

## Files

- `index.html` – the page
- `style.css` – the look
- `app.js` – search and links (no need to touch)
- `guides.json` – all guides and their on/off status (the admin panel edits this)
- `admin.html`, `admin.js`, `admin.css` – the admin panel
- `pdfs/` – your PDF files

## Live site

**https://nourabouzour.github.io/tutorials/**

It's hosted free on GitHub Pages from this repo's `main` branch. Every push to `main`
updates the live site within about a minute.

## How the guide PDFs are made

Each PDF is written as a web page in `guide-source/` (for example `guide-source/seo.html`)
using the shared design in `guide-source/guide.css`. To rebuild the PDFs after a change:

```
python guide-source/build.py          # all guides
python guide-source/build.py seo      # just one
```

It prints each page with Chrome (or Edge) and saves the result in `pdfs/`.
