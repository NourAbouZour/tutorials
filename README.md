# Guides site

A one-page site where people from your reels find the PDF guide for the word they commented.

## Add a new guide (2 steps)

1. Drop the PDF into the `pdfs` folder, e.g. `pdfs/budget.pdf`
   (use simple file names: lowercase, no spaces).
2. Open `guides.js` and add a block to `GUIDES`:

```js
{
  word: "BUDGET",
  title: "The simple budget guide",
  description: "What's inside the PDF, in one or two sentences.",
  pdf: "budget.pdf",
  video: "https://www.instagram.com/reel/XXXXXXXX/",
  date: "2026-11-08"
},
```

- `video` is the link to the reel (Instagram app: ⋯ → Copy link). Leave it as `""` to hide the button.
- `date` is the day you posted it, written YEAR-MONTH-DAY. It powers the date filters,
  the Newest/Oldest sorting and the "New" tag (shown for 7 days).

That's it. Refresh the page.

Your name, @handle, Instagram link, intro text and (optional) profile photo are at the top of `guides.js` under `SITE`.

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
- `guides.js` – **your content, edit this one**
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
