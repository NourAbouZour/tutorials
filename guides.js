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
  /* Copy this block for each new reel (and remove the slashes and stars around it):

  {
    word: "WORD",
    title: "Guide title",
    description: "What's inside the PDF, in one or two sentences.",
    pdf: "word.pdf",
    video: "https://www.instagram.com/reel/XXXXXXXX/",
    date: "2026-11-08"
  },

  */

  {
    word: "FOUNDER",
    title: "Founder Skill: test your business before you spend a dollar",
    description: "Install the free Founder Skill in Claude and get an AI board of directors, marketing director and CFO. Then run your idea past 100 simulated customers to see who buys, who doesn't, and why.",
    pdf: "founder.pdf",
    video: "",
    date: "2026-11-08"
  },
  {
    word: "FACE OFF",
    title: "Dual Skill: make Claude and ChatGPT debate",
    description: "Bring ChatGPT into your Claude chat and make them pick apart each other's answers until only the best one is left. Includes getting an OpenAI API key safely and keeping costs low.",
    pdf: "face-off.pdf",
    video: "",
    date: "2026-11-08"
  },
  {
    word: "EDIT",
    title: "Build your own AI video editor with Claude Code",
    description: "Set up Claude Code with FFmpeg, Whisper, Hyperframes and yt-dlp, create a style sheet from reels you love, and edit raw footage into finished reels with captions, music and motion graphics. Every prompt included.",
    pdf: "edit.pdf",
    video: "",
    date: "2026-11-08"
  },
  {
    word: "SEO",
    title: "The Parasite SEO playbook",
    description: "Reach the first page of Google, and get quoted by ChatGPT, without a website. Five methods: 2027 posts, Zenodo research, short LinkedIn articles, Gamma decks and helpful Reddit answers, plus a 14-day plan.",
    pdf: "seo.pdf",
    video: "",
    date: "2026-11-08"
  }
];
