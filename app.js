(function () {
  var site = window.SITE || {};
  var DAY = 86400000;

  /* Parse "YYYY-MM-DD" as a local date (no timezone shift). */
  function parseDate(s) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || "").trim());
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d) ? null : d;
  }

  var guides = (window.GUIDES || []).map(function (g, i) {
    return Object.assign({ index: i, when: parseDate(g.date) }, g);
  });

  var state = { range: "all", newest: true };

  var $ = function (id) { return document.getElementById(id); };
  var input = $("q");
  var list = $("list");
  var empty = $("empty");
  var count = $("count");
  var clearBtn = $("clear");
  var toast = $("toast");
  var sortBtn = $("sort");

  /* ---------- Branding ---------- */
  var name = site.name || "Guides";
  var handle = site.handle || "";
  var ig = site.instagram || "#";

  $("site-name").textContent = name;
  $("site-intro").textContent = site.intro || "";
  $("brand-name").textContent = handle || name;
  $("brand").href = ig;
  $("follow").href = ig;
  $("foot-name").textContent = name;
  $("year").textContent = new Date().getFullYear();
  $("badge").querySelector("span").textContent = site.badge || "Free guides";
  if (handle) {
    $("foot-link").textContent = "Follow " + handle + " for more";
    $("foot-link").href = ig;
  }
  var avatar = $("avatar");
  if (site.photo) avatar.style.backgroundImage = "url('" + site.photo + "')";
  else avatar.textContent = name.trim().charAt(0).toUpperCase();

  /* ---------- Helpers ---------- */
  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[ً-ْ]/g, "") // Arabic diacritics
      .trim();
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function highlight(text, q) {
    var safe = escapeHtml(text);
    if (!q) return safe;
    var pattern = escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return safe.replace(new RegExp("(" + pattern + ")", "gi"), "<mark>$1</mark>");
  }

  function today() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function daysAgo(d) {
    return Math.round((today() - d) / DAY);
  }

  var fmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

  function relative(d) {
    var n = daysAgo(d);
    if (n <= 0) return "Today";
    if (n === 1) return "Yesterday";
    if (n < 7) return n + " days ago";
    if (n < 30) { var w = Math.floor(n / 7); return w + (w === 1 ? " week ago" : " weeks ago"); }
    if (n < 365) { var m = Math.floor(n / 30); return m + (m === 1 ? " month ago" : " months ago"); }
    var y = Math.floor(n / 365); return y + (y === 1 ? " year ago" : " years ago");
  }

  function inRange(g) {
    if (state.range === "all") return true;
    if (!g.when) return false;
    if (state.range === "year") return g.when.getFullYear() === today().getFullYear();
    return daysAgo(g.when) < Number(state.range);
  }

  function linkFor(word) {
    return location.origin + location.pathname + "?word=" + encodeURIComponent(word);
  }

  var toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 1800);
  }

  var icons = {
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M10 8.5v7l6-3.5z"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'
  };

  /* ---------- Search, filter, sort ---------- */
  function search(raw) {
    var q = normalize(raw);

    return guides
      .filter(inRange)
      .map(function (g) {
        if (!q) return { g: g, score: 1 };
        var w = normalize(g.word);
        var score = -1;
        if (w === q) score = 4;
        else if (w.indexOf(q) === 0) score = 3;
        else if (w.indexOf(q) > -1) score = 2;
        else if ((normalize(g.title) + " " + normalize(g.description)).indexOf(q) > -1) score = 1;
        return { g: g, score: score };
      })
      .filter(function (r) { return r.score > 0; })
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        var ta = a.g.when ? a.g.when.getTime() : null;
        var tb = b.g.when ? b.g.when.getTime() : null;
        if (ta === null && tb === null) return a.g.index - b.g.index;
        if (ta === null) return 1;   // undated guides go last
        if (tb === null) return -1;
        return state.newest ? tb - ta : ta - tb;
      })
      .map(function (r) { return r.g; });
  }

  function cardHtml(g, q, exact) {
    var isMatch = exact && normalize(g.word) === exact;
    var isNew = g.when && daysAgo(g.when) < 7;

    var pdfBtn = g.pdf
      ? '<a class="btn btn-primary" href="pdfs/' + encodeURI(g.pdf) + '" download target="_blank" rel="noopener">' +
          icons.download + "Download PDF</a>"
      : '<span class="btn btn-missing">PDF coming soon</span>';

    var videoBtn = g.video
      ? '<a class="btn btn-ghost" href="' + escapeHtml(g.video) + '" target="_blank" rel="noopener">' +
          icons.play + "Watch the reel</a>"
      : "";

    var meta = g.when
      ? '<div class="meta">' + icons.cal +
          '<time datetime="' + escapeHtml(g.date) + '">' + fmt.format(g.when) + "</time>" +
          "<span>·</span><span>" + relative(g.when) + "</span></div>"
      : "";

    return (
      '<article class="card' + (isMatch ? " is-match" : "") + '" id="' + escapeHtml(normalize(g.word)) + '">' +
        '<div class="card-top">' +
          '<div class="tags">' +
            '<span class="word" dir="auto">' + highlight(g.word, q) + "</span>" +
            (isNew ? '<span class="new">New</span>' : "") +
          "</div>" +
          '<button class="share" type="button" data-word="' + escapeHtml(g.word) + '" aria-label="Copy link to the ' + escapeHtml(g.word) + ' guide" title="Copy link">' +
            icons.link +
          "</button>" +
        "</div>" +
        '<h2 dir="auto">' + highlight(g.title, q) + "</h2>" +
        '<p dir="auto">' + highlight(g.description, q) + "</p>" +
        meta +
        '<div class="actions' + (videoBtn ? "" : " single") + '">' + pdfBtn + videoBtn + "</div>" +
        (handle
          ? '<a class="follow-cta" href="' + escapeHtml(ig) + '" target="_blank" rel="noopener">' +
              "Found this useful? <strong>Follow " + escapeHtml(handle) + "</strong> for a new free guide every week" +
            "</a>"
          : "") +
      "</article>"
    );
  }

  function render() {
    var raw = input.value;
    var q = raw.trim();
    var results = search(raw);
    var exact = normalize(q);
    var n = results.length;

    var none = guides.length === 0;
    $("empty-title").textContent = none ? "Guides coming soon" : "No guide found";
    $("empty-text").hidden = none;
    $("empty-soon").hidden = !none;
    document.querySelector(".filters").hidden = none;

    clearBtn.hidden = !raw;
    empty.hidden = n > 0;
    count.hidden = n === 0;
    count.textContent = n + (n === 1 ? " guide" : " guides") +
      (q || state.range !== "all" ? " found" : "");

    list.innerHTML = results.map(function (g) { return cardHtml(g, q, exact); }).join("");
  }

  function syncUrl() {
    var q = input.value.trim();
    var url = location.pathname + (q ? "?word=" + encodeURIComponent(q) : "");
    try { history.replaceState(null, "", url); } catch (e) {}
  }

  /* ---------- Events ---------- */
  var urlTimer;
  input.addEventListener("input", function () {
    render();
    clearTimeout(urlTimer);
    urlTimer = setTimeout(syncUrl, 400);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { input.value = ""; render(); syncUrl(); }
    if (e.key === "Enter") input.blur(); // hide the phone keyboard
  });

  clearBtn.addEventListener("click", function () {
    input.value = ""; render(); syncUrl(); input.focus();
  });

  $("ranges").addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    state.range = chip.getAttribute("data-range");
    document.querySelectorAll(".chip").forEach(function (c) {
      c.setAttribute("aria-pressed", c === chip ? "true" : "false");
    });
    render();
  });

  sortBtn.addEventListener("click", function () {
    state.newest = !state.newest;
    $("sort-label").textContent = state.newest ? "Newest first" : "Oldest first";
    sortBtn.classList.toggle("is-oldest", !state.newest);
    render();
  });

  $("show-all").addEventListener("click", function () {
    input.value = "";
    state.range = "all";
    document.querySelectorAll(".chip").forEach(function (c) {
      c.setAttribute("aria-pressed", c.getAttribute("data-range") === "all" ? "true" : "false");
    });
    render(); syncUrl();
  });

  list.addEventListener("click", function (e) {
    var btn = e.target.closest(".share");
    if (!btn) return;
    var url = linkFor(btn.getAttribute("data-word"));
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(
        function () { showToast("Link copied"); },
        function () { fallbackCopy(url); }
      );
    } else {
      fallbackCopy(url);
    }
  });

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); showToast("Link copied"); }
    catch (e) { window.prompt("Copy this link:", text); }
    ta.remove();
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    }
  });

  /* ---------- Start: read ?word= from the link ---------- */
  var params = new URLSearchParams(location.search);
  var start = params.get("word") || params.get("q") || decodeURIComponent(location.hash.slice(1));
  if (start) input.value = start;
  render();
})();
