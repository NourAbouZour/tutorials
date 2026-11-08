/*
  ============================================================
  EDIT THIS FILE TO UPDATE YOUR SITE
  ============================================================

  1. Put your PDF files inside the "pdfs" folder.
  2. Add one block to GUIDES for each reel / comment word.

  Each guide has:
    word        – the word people comment on your reel (e.g. "PLAN")
    title       – the name of the guide
    description – a short explanation of what's inside
    pdf         – the file name inside the "pdfs" folder
    video       – the link to the Instagram reel
    date        – the day you posted the reel, as YEAR-MONTH-DAY (e.g. "2026-11-05")

  The site sorts by date automatically, so the order here doesn't matter.
  Remember the comma after each } except the last one.
*/

window.SITE = {
  name: "Nour Abou Zour",
  handle: "@nour_abou_zour",
  instagram: "https://www.instagram.com/nour_abou_zour/",
  photo: "",            // optional: e.g. "photo.jpg" (put the image next to index.html)
  badge: "Free guides",
  intro: "Every guide from my reels in one place. Search the word you commented, watch the reel again, and download the PDF."
};

window.GUIDES = [
  {
    word: "START",
    title: "The beginner's starter guide",
    description: "Everything from the video in one place: the first steps, the mistakes to avoid, and a simple checklist to get going this week.",
    pdf: "start.pdf",
    video: "https://www.instagram.com/nour_abou_zour/",
    date: "2026-11-06"
  },
  {
    word: "PLAN",
    title: "30-day plan",
    description: "A day-by-day plan you can print and follow. Each week builds on the last, with space to track your progress.",
    pdf: "plan.pdf",
    video: "https://www.instagram.com/nour_abou_zour/",
    date: "2026-10-28"
  },
  {
    word: "TOOLS",
    title: "My favourite tools and resources",
    description: "The full list of apps, books and resources I mentioned, with a short note on what each one is best for.",
    pdf: "tools.pdf",
    video: "https://www.instagram.com/nour_abou_zour/",
    date: "2026-09-14"
  },
  {
    word: "HABITS",
    title: "5 habits that changed everything",
    description: "The five habits from the reel explained in more detail, plus how to start each one in under 10 minutes a day.",
    pdf: "habits.pdf",
    video: "https://www.instagram.com/nour_abou_zour/",
    date: "2026-03-02"
  }
];
