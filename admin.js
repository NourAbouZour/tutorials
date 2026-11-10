/*
  Guides admin.
  Reads and saves guides.json in the GitHub repo through the GitHub API,
  so switching a guide on here publishes it to the live site (GitHub Pages
  rebuilds in about a minute). The token lives only in this browser.
*/
(function () {
  var REPO = "NourAbouZour/tutorials";
  var BRANCH = "main";
  var FILE = "guides.json";
  var API = "https://api.github.com/repos/" + REPO + "/contents/" + FILE;
  var TOKEN_KEY = "guides-admin-token";

  var $ = function (id) { return document.getElementById(id); };
  var state = { data: null, sha: null, show: "all", q: "", open: {} };

  /* ---------- Token storage (wrapped: storage can be blocked) ---------- */
  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  /* ---------- UTF-8 safe base64 ---------- */
  function decode(b64) {
    var bin = atob(b64.replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function encode(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function gh(method, body) {
    return fetch(API + (method === "GET" ? "?ref=" + BRANCH + "&t=" + Date.now() : ""), {
      method: method,
      cache: "no-store",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + getToken(),
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.message || ("GitHub error " + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  /* ---------- Load ---------- */
  function load() {
    $("loading").hidden = false;
    var token = getToken();
    var p = token
      ? gh("GET").then(function (j) { state.sha = j.sha; return JSON.parse(decode(j.content)); })
      : fetch(FILE, { cache: "no-cache" }).then(function (r) { return r.json(); });

    return p.then(function (data) {
      state.data = data;
      $("loading").hidden = true;
      setConnected(!!token);
      render();
    }).catch(function (err) {
      $("loading").hidden = true;
      if (token && (err.status === 401 || err.status === 403 || err.status === 404)) {
        setToken("");
        showConnError("That token didn't work (" + err.message + "). Check it has access to the tutorials repo with Contents: Read and write, then try again.");
        return load();
      }
      $("loading").hidden = false;
      $("loading").textContent = "Couldn't load the guides: " + err.message;
    });
  }

  function setConnected(on) {
    $("connect-form").hidden = on;
    $("disconnect").hidden = !on;
    $("conn-status").textContent = on
      ? "Connected to GitHub. Changes you save go live in about a minute."
      : "Not connected. You can look around, but you can't save changes.";
  }
  function showConnError(msg) { var e = $("conn-error"); e.textContent = msg; e.hidden = !msg; }

  /* ---------- Helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  /* Accepts any Instagram reel/post link and returns a clean one without tracking bits. */
  function cleanReel(url) {
    var m = /instagram\.com\/(?:[\w.]+\/)?(reel|reels|p|tv)\/([\w-]+)/i.exec(String(url || ""));
    return m ? "https://www.instagram.com/" + (m[1].toLowerCase() === "reels" ? "reel" : m[1].toLowerCase()) + "/" + m[2] + "/" : "";
  }
  function fmtDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" }) : "No date";
  }
  var toastTimer;
  function toast(msg, ms) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, ms || 2600);
  }

  /* ---------- Render ---------- */
  function render() {
    var guides = state.data.guides || [];
    var live = guides.filter(function (g) { return g.active !== false; }).length;
    $("n-all").textContent = guides.length;
    $("n-live").textContent = live;
    $("n-draft").textContent = guides.length - live;

    var q = state.q.toLowerCase();
    var rows = guides.map(function (g, i) { return { g: g, i: i }; }).filter(function (r) {
      var isLive = r.g.active !== false;
      if (state.show === "live" && !isLive) return false;
      if (state.show === "draft" && isLive) return false;
      return !q || (r.g.word + " " + r.g.title + " " + r.g.description).toLowerCase().indexOf(q) > -1;
    });
    // Drafts first (they need attention), then live, newest first.
    rows.sort(function (a, b) {
      var la = a.g.active !== false, lb = b.g.active !== false;
      if (la !== lb) return la ? 1 : -1;
      return String(b.g.date || "9999").localeCompare(String(a.g.date || "9999")) || a.i - b.i;
    });

    var connected = !!getToken();
    $("items").innerHTML = rows.length ? rows.map(function (r) { return itemHtml(r.g, r.i, connected); }).join("")
      : '<p class="muted center">Nothing here.</p>';
  }

  function itemHtml(g, i, connected) {
    var isLive = g.active !== false;
    var dis = connected ? "" : " disabled";
    var reel = g.video || "";
    var pdfUrl = "pdfs/" + encodeURI(g.pdf || "");
    return (
      '<article class="item' + (isLive ? "" : " is-draft") + '" data-i="' + i + '">' +
        '<div class="item-top">' +
          '<span class="status ' + (isLive ? "live" : "draft") + '">' + (isLive ? "Live" : "Draft") + "</span>" +
          '<span class="word">' + esc(g.word) + "</span>" +
          '<span class="item-date">' + (isLive ? "Posted " + fmtDate(g.date) : "Not on the site yet") + "</span>" +
        "</div>" +
        '<div class="fields">' +
          '<div class="field"><label for="t' + i + '">Title</label><input id="t' + i + '" data-k="title" value="' + esc(g.title) + '"' + dis + "></div>" +
          '<div class="field"><label for="d' + i + '">Description <small>(shown on the site)</small></label><textarea id="d' + i + '" data-k="description" rows="3"' + dis + ">" + esc(g.description) + "</textarea></div>" +
          '<div class="field-row">' +
            '<div class="field"><label for="v' + i + '">Instagram reel link</label>' +
              '<input id="v' + i + '" data-k="video" type="url" inputmode="url" placeholder="Paste the reel link from Instagram" value="' + esc(reel) + '"' + dis + ">" +
              '<p class="hint" data-hint>' + (reel ? "" : "Add the reel link to switch this guide on.") + "</p></div>" +
            '<div class="field"><label for="dt' + i + '">Date posted</label><input id="dt' + i + '" data-k="date" type="date" value="' + esc(g.date || "") + '"' + dis + "></div>" +
          "</div>" +
          '<div class="field"><label>PDF</label>' +
            '<div class="pdf-row">' +
              '<a href="' + pdfUrl + '" target="_blank" rel="noopener">Open PDF ↗</a>' +
              '<button type="button" data-act="preview">' + (state.open[i] ? "Hide preview" : "Preview here") + "</button>" +
              '<span class="file">' + esc(g.pdf) + "</span>" +
            "</div>" +
            (state.open[i] ? '<iframe class="pdf-frame" src="' + pdfUrl + '" title="' + esc(g.word) + ' PDF"></iframe>' : "") +
          "</div>" +
        "</div>" +
        '<div class="item-actions">' +
          (isLive
            ? '<button type="button" data-act="save"' + dis + ">Save changes</button>" +
              '<button type="button" class="stop" data-act="off"' + dis + ">Take off the site</button>"
            : '<button type="button" data-act="save"' + dis + ">Save draft</button>" +
              '<button type="button" class="go" data-act="on"' + dis + ">Activate: put it live</button>") +
        "</div>" +
      "</article>"
    );
  }

  /* ---------- Save ---------- */
  function readForm(card) {
    var out = {};
    card.querySelectorAll("[data-k]").forEach(function (el) { out[el.getAttribute("data-k")] = el.value.trim(); });
    return out;
  }

  function save(index, changes, message, okMsg) {
    var buttons = document.querySelectorAll(".item-actions button");
    buttons.forEach(function (b) { b.disabled = true; });
    toast("Saving…", 20000);

    // Always start from the latest file on GitHub, so nothing saved elsewhere is lost.
    return gh("GET").then(function (j) {
      var latest = JSON.parse(decode(j.content));
      var word = state.data.guides[index].word;
      var target = latest.guides.filter(function (g) { return g.word === word; })[0];
      if (!target) throw new Error("This guide no longer exists on GitHub. Refresh the page.");
      Object.assign(target, changes);
      var text = JSON.stringify(latest, null, 2) + "\n";
      return gh("PUT", { message: message + " (from admin)", content: encode(text), sha: j.sha, branch: BRANCH })
        .then(function (res) { state.sha = res.content && res.content.sha; state.data = latest; });
    }).then(function () {
      render();
      toast(okMsg, 4500);
    }).catch(function (err) {
      buttons.forEach(function (b) { b.disabled = false; });
      toast("Couldn't save: " + err.message, 6000);
    });
  }

  $("items").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-act]");
    if (!btn) return;
    var card = btn.closest(".item");
    var i = +card.getAttribute("data-i");
    var g = state.data.guides[i];
    var act = btn.getAttribute("data-act");

    if (act === "preview") { state.open[i] = !state.open[i]; render(); return; }

    var f = readForm(card);
    var changes = { title: f.title, description: f.description, date: f.date };
    var reelInput = card.querySelector('[data-k="video"]');
    var hint = card.querySelector("[data-hint]");

    if (f.video) {
      var clean = cleanReel(f.video);
      if (!clean) {
        hint.textContent = "That doesn't look like an Instagram reel link. It should look like instagram.com/reel/…";
        hint.classList.add("bad"); reelInput.focus(); return;
      }
      changes.video = clean;
    } else {
      changes.video = "";
    }

    if (!changes.title) { toast("The title can't be empty."); return; }

    if (act === "on") {
      if (!changes.video) {
        hint.textContent = "Paste the Instagram reel link first. The guide goes live with its reel.";
        hint.classList.add("bad"); reelInput.focus(); return;
      }
      if (!changes.date) changes.date = today();
      changes.active = true;
      save(i, changes, "Activate " + g.word, g.word + " is going live. It'll show on the site in about a minute.");
    } else if (act === "off") {
      if (!confirm("Take " + g.word + " off the live site? You can switch it back on any time.")) return;
      changes.active = false;
      save(i, changes, "Deactivate " + g.word, g.word + " is coming off the site (about a minute).");
    } else {
      save(i, changes, "Update " + g.word, "Saved.");
    }
  });

  /* ---------- Connect / filters ---------- */
  $("token-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var t = $("token").value.trim();
    if (!t) return;
    showConnError("");
    setToken(t);
    $("token").value = "";
    load().then(function () { if (getToken()) toast("Connected."); });
  });

  $("disconnect").addEventListener("click", function () {
    setToken(""); state.sha = null; load();
  });

  document.querySelector(".admin-tools .chips").addEventListener("click", function (e) {
    var c = e.target.closest(".chip"); if (!c) return;
    state.show = c.getAttribute("data-show");
    document.querySelectorAll(".admin-tools .chip").forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
    render();
  });

  $("q").addEventListener("input", function () { state.q = this.value.trim(); render(); });

  load();
})();
