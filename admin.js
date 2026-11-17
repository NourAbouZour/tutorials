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
  var LOCK_FILE = "admin-lock.json";
  var DRAFTS_REPO = "NourAbouZour/tutorials-drafts";  // PRIVATE repo: drafts + their PDFs
  var DRAFTS_FILE = "drafts.json";       // the token, encrypted with your password
  var TOKEN_KEY = "guides-admin-token";
  var ITERATIONS = 600000;                 // slows down password guessing

  var $ = function (id) { return document.getElementById(id); };
  var state = { items: [], lock: null, show: "all", q: "", open: {}, blobs: {} };

  /* ---------- Where the unlocked token is kept ----------
     "Stay unlocked" = localStorage (until you press Lock).
     Otherwise sessionStorage (until the tab is closed). */
  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }
  function setToken(t, remember) {
    try {
      localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
      if (t) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t);
    } catch (e) {}
  }

  /* ---------- Base64 helpers ---------- */
  function bytesToB64(bytes) { var bin = ""; for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin); }
  function b64ToBytes(b64) { var bin = atob(b64.replace(/\s/g, "")); var out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  function decode(b64) { return new TextDecoder().decode(b64ToBytes(b64)); }
  function encode(str) { return bytesToB64(new TextEncoder().encode(str)); }

  /* ---------- Password encryption (PBKDF2 + AES-GCM, built into the browser) ---------- */
  function keyFrom(password, salt, iterations) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      });
  }
  function lockToken(token, password) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return keyFrom(password, salt, ITERATIONS).then(function (key) {
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(token));
    }).then(function (ct) {
      return { v: 1, kdf: "PBKDF2-SHA256", iterations: ITERATIONS, salt: bytesToB64(salt), iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(ct)) };
    });
  }
  function unlockToken(lock, password) {
    return keyFrom(password, b64ToBytes(lock.salt), lock.iterations).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(lock.iv) }, key, b64ToBytes(lock.data));
    }).then(function (plain) { return new TextDecoder().decode(plain); });
  }

  /* ---------- GitHub API ---------- */
  function gh(path, method, body, token, repo) {
    var url = "https://api.github.com/repos/" + (repo || REPO) + "/contents/" + path +
      (method === "GET" ? "?ref=" + BRANCH + "&t=" + Date.now() : "");
    return fetch(url, {
      method: method,
      cache: "no-store",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + (token || getToken()),
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

  /* Download a file's raw bytes (works for private repos and files over 1 MB). */
  function ghRaw(path, repo) {
    return fetch("https://api.github.com/repos/" + repo + "/contents/" + path + "?ref=" + BRANCH + "&t=" + Date.now(), {
      cache: "no-store",
      headers: { "Accept": "application/vnd.github.raw", "Authorization": "Bearer " + getToken(), "X-GitHub-Api-Version": "2022-11-28" }
    }).then(function (r) {
      if (!r.ok) { var e = new Error("Couldn't download " + path + " (" + r.status + ")"); e.status = r.status; throw e; }
      return r.arrayBuffer();
    });
  }
  function shaOf(path, repo) {
    return gh(path, "GET", null, null, repo).then(function (j) { return j.sha; }, function (e) { if (e.status === 404) return null; throw e; });
  }
  function putBytes(path, repo, buffer, message) {
    return shaOf(path, repo).then(function (sha) {
      var body = { message: message, content: bytesToB64(new Uint8Array(buffer)), branch: BRANCH };
      if (sha) body.sha = sha;
      return gh(path, "PUT", body, null, repo);
    });
  }
  function deleteFile(path, repo, message) {
    return shaOf(path, repo).then(function (sha) {
      if (!sha) return null;
      return gh(path, "DELETE", { message: message, sha: sha, branch: BRANCH }, null, repo);
    });
  }
  /* Read a JSON file, change it, save it back (always from the latest version). */
  function updateJson(path, repo, mutate, message) {
    return gh(path, "GET", null, null, repo).then(function (j) {
      var data = JSON.parse(decode(j.content));
      mutate(data);
      return gh(path, "PUT", { message: message, content: encode(JSON.stringify(data, null, 2) + "\n"), sha: j.sha, branch: BRANCH }, null, repo);
    });
  }

  /* Save the encrypted token to the repo (create or replace). */
  function saveLock(lock, token) {
    var body = { message: "Update admin lock (from admin)", content: encode(JSON.stringify(lock, null, 2) + "\n"), branch: BRANCH };
    return gh(LOCK_FILE, "GET", null, token)
      .then(function (j) { body.sha = j.sha; }, function (e) { if (e.status !== 404) throw e; })
      .then(function () { return gh(LOCK_FILE, "PUT", body, token); });
  }

  /* ---------- Screens ---------- */
  function show(screen) {
    ["lock-panel", "setup-panel", "conn-panel"].forEach(function (id) { $(id).hidden = id !== screen; });
    $("content").hidden = screen !== "conn-panel";
    $("loading").hidden = true;
  }
  function err(id, msg) { var e = $(id); e.textContent = msg || ""; e.hidden = !msg; }
  function busy(form, on) { form.querySelector("button[type=submit]").disabled = on; }

  function start() {
    if (!window.crypto || !crypto.subtle) {
      $("loading").textContent = "This browser can't run the admin securely. Open it over https in an up-to-date browser.";
      return;
    }
    if (getToken()) { openAdmin(); return; }
    fetch(LOCK_FILE + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (lock) {
        state.lock = lock;
        show(lock ? "lock-panel" : "setup-panel");
        if (lock) $("unlock-pw").focus();
      })
      .catch(function () { show("setup-panel"); });
  }

  function openAdmin() {
    $("loading").hidden = false;
    var live = gh(FILE, "GET");
    var drafts = gh(DRAFTS_FILE, "GET", null, null, DRAFTS_REPO).then(null, function (e) { return { error: e }; });
    return Promise.all([live, drafts]).then(function (res) {
      var pub = JSON.parse(decode(res[0].content));
      var items = (pub.guides || []).map(function (g) { return { g: Object.assign({}, g, { active: true }), where: "live" }; });
      var warn = $("drafts-warn");
      if (res[1].error) {
        warn.hidden = false;
        warn.textContent = res[1].error.status === 404 || res[1].error.status === 403
          ? "Your private drafts are hidden from this token. On GitHub, edit your Guides admin token → Repository access → also select tutorials-drafts (Contents: Read and write). Then press Lock and unlock again."
          : "Couldn't load your private drafts: " + res[1].error.message;
      } else {
        warn.hidden = true;
        var priv = JSON.parse(decode(res[1].content));
        (priv.guides || []).forEach(function (g) { items.push({ g: Object.assign({}, g, { active: false }), where: "draft" }); });
      }
      state.items = items;
      show("conn-panel");
      render();
    }).catch(function (e) {
      setToken("");
      $("loading").hidden = true;
      if (e.status === 401 || e.status === 403 || e.status === 404) {
        state.lock = null;
        show("setup-panel");
        err("setup-error", "Your GitHub token stopped working (it may have expired or been deleted). Paste a new token and set your password again.");
      } else {
        start();
      }
    });
  }

  /* Unlock with password */
  $("unlock-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = this, pw = $("unlock-pw").value;
    if (!pw || !state.lock) return;
    err("unlock-error"); busy(form, true);
    unlockToken(state.lock, pw).then(function (token) {
      setToken(token, $("remember").checked);
      $("unlock-pw").value = "";
      return openAdmin();
    }, function () {
      err("unlock-error", "Wrong password. Try again.");
    }).then(function () { busy(form, false); });
  });

  /* First-time setup: token + password */
  $("setup-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = this;
    var token = $("setup-token").value.trim(), pw = $("setup-pw").value, pw2 = $("setup-pw2").value;
    err("setup-error");
    if (pw.length < 10) { err("setup-error", "Please use a password with at least 10 characters."); return; }
    if (pw !== pw2) { err("setup-error", "The two passwords don't match."); return; }
    busy(form, true);
    gh(FILE, "GET", null, token).catch(function (e2) {
      throw new Error("That token didn't work (" + e2.message + "). Check it has access to the tutorials repo with Contents: Read and write.");
    }).then(function () {
      return lockToken(token, pw);
    }).then(function (lock) {
      return saveLock(lock, token).then(function () { state.lock = lock; });
    }).then(function () {
      setToken(token, true);
      ["setup-token", "setup-pw", "setup-pw2"].forEach(function (id) { $(id).value = ""; });
      toast("Password set. From now on, just use your password.", 4000);
      return openAdmin();
    }).catch(function (e3) {
      err("setup-error", e3.message);
    }).then(function () { busy(form, false); });
  });

  $("lock").addEventListener("click", function () {
    setToken("");
    state.items = []; state.blobs = {}; state.open = {};
    $("items").innerHTML = "";
    start();
  });

  $("change-pw").addEventListener("click", function () {
    var pw = prompt("New admin password (at least 10 characters):");
    if (pw == null) return;
    if (pw.length < 10) { toast("Password not changed: use at least 10 characters.", 4000); return; }
    if (prompt("Type the new password again:") !== pw) { toast("Password not changed: they didn't match.", 4000); return; }
    var token = getToken();
    toast("Changing password…", 20000);
    lockToken(token, pw)
      .then(function (lock) { return saveLock(lock, token).then(function () { state.lock = lock; }); })
      .then(function () { toast("Password changed.", 3000); })
      .catch(function (e) { toast("Couldn't change password: " + e.message, 6000); });
  });

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
    var items = state.items;
    var live = items.filter(function (it) { return it.where === "live"; }).length;
    $("n-all").textContent = items.length;
    $("n-live").textContent = live;
    $("n-draft").textContent = items.length - live;

    var q = state.q.toLowerCase();
    var rows = items.map(function (it, i) { return { it: it, i: i }; }).filter(function (r) {
      if (state.show === "live" && r.it.where !== "live") return false;
      if (state.show === "draft" && r.it.where !== "draft") return false;
      var g = r.it.g;
      return !q || (g.word + " " + g.title + " " + g.description).toLowerCase().indexOf(q) > -1;
    });
    // Drafts first (they need attention), then live, newest first.
    rows.sort(function (a, b) {
      if (a.it.where !== b.it.where) return a.it.where === "draft" ? -1 : 1;
      return String(b.it.g.date || "9999").localeCompare(String(a.it.g.date || "9999")) || a.i - b.i;
    });
    $("items").innerHTML = rows.length ? rows.map(function (r) { return itemHtml(r.it, r.i); }).join("")
      : '<p class="muted center">Nothing here.</p>';
  }

  function itemHtml(it, i) {
    var g = it.g, isLive = it.where === "live";
    var reel = g.video || "";
    var frameSrc = isLive ? "pdfs/" + encodeURI(g.pdf || "") : (state.blobs[g.word] || "");
    return (
      '<article class="item' + (isLive ? "" : " is-draft") + '" data-i="' + i + '">' +
        '<div class="item-top">' +
          '<span class="status ' + (isLive ? "live" : "draft") + '">' + (isLive ? "Live" : "Draft · private") + "</span>" +
          '<span class="word">' + esc(g.word) + "</span>" +
          '<span class="item-date">' + (isLive ? "Posted " + fmtDate(g.date) : "Only you can see this") + "</span>" +
        "</div>" +
        '<div class="fields">' +
          '<div class="field"><label for="t' + i + '">Title</label><input id="t' + i + '" data-k="title" value="' + esc(g.title) + '"></div>' +
          '<div class="field"><label for="d' + i + '">Description <small>(shown on the site)</small></label><textarea id="d' + i + '" data-k="description" rows="3">' + esc(g.description) + "</textarea></div>" +
          '<div class="field-row">' +
            '<div class="field"><label for="v' + i + '">Instagram reel link</label>' +
              '<input id="v' + i + '" data-k="video" type="url" inputmode="url" placeholder="Paste the reel link from Instagram" value="' + esc(reel) + '">' +
              '<p class="hint" data-hint>' + (reel ? "" : "Add the reel link to switch this guide on.") + "</p></div>" +
            '<div class="field"><label for="dt' + i + '">Date posted</label><input id="dt' + i + '" data-k="date" type="date" value="' + esc(g.date || "") + '"></div>' +
          "</div>" +
          '<div class="field"><label>PDF</label>' +
            '<div class="pdf-row">' +
              '<button type="button" data-act="open">Open PDF ↗</button>' +
              '<button type="button" data-act="preview">' + (state.open[i] ? "Hide preview" : "Preview here") + "</button>" +
              '<span class="file">' + esc(g.pdf) + "</span>" +
            "</div>" +
            (state.open[i] && frameSrc ? '<iframe class="pdf-frame" src="' + frameSrc + '" title="' + esc(g.word) + ' PDF"></iframe>' : "") +
          "</div>" +
        "</div>" +
        '<div class="item-actions">' +
          (isLive
            ? '<button type="button" data-act="save">Save changes</button>' +
              '<button type="button" class="stop" data-act="off">Take off the site</button>'
            : '<button type="button" data-act="save">Save draft</button>' +
              '<button type="button" class="go" data-act="on">Activate: put it live</button>') +
        "</div>" +
      "</article>"
    );
  }

  /* Draft PDFs live in the private repo, so they're downloaded with the token. */
  function draftPdfUrl(g) {
    if (state.blobs[g.word]) return Promise.resolve(state.blobs[g.word]);
    return ghRaw("pdfs/" + g.pdf, DRAFTS_REPO).then(function (buf) {
      var url = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
      state.blobs[g.word] = url;
      return url;
    });
  }

  /* ---------- Save ---------- */
  function readForm(card) {
    var out = {};
    card.querySelectorAll("[data-k]").forEach(function (el) { out[el.getAttribute("data-k")] = el.value.trim(); });
    return out;
  }
  function without(list, word) { return (list || []).filter(function (x) { return x.word !== word; }); }
  function clean(g) { var c = Object.assign({}, g); delete c.active; return c; }

  function run(steps, okMsg) {
    var buttons = document.querySelectorAll(".item-actions button");
    buttons.forEach(function (b) { b.disabled = true; });
    toast("Working… don't close this page.", 60000);
    return steps().then(function () {
      toast(okMsg, 5000);
      return openAdmin();
    }).catch(function (err) {
      buttons.forEach(function (b) { b.disabled = false; });
      toast("Couldn't finish: " + err.message + ". Refresh and check the guide.", 8000);
    });
  }

  function saveDraft(g, ch) {
    return run(function () {
      return updateJson(DRAFTS_FILE, DRAFTS_REPO, function (d) {
        d.guides.forEach(function (x) { if (x.word === g.word) Object.assign(x, ch); });
      }, "Update draft " + g.word + " (from admin)");
    }, "Draft saved.");
  }

  function saveLive(g, ch) {
    return run(function () {
      return updateJson(FILE, REPO, function (d) {
        d.guides.forEach(function (x) { if (x.word === g.word) Object.assign(x, ch); });
      }, "Update " + g.word + " (from admin)");
    }, "Saved. The site updates in about a minute.");
  }

  /* Draft → live: copy the PDF from the private repo to the public site, then move the entry. */
  function activate(g, ch) {
    var entry = Object.assign(clean(g), ch, { active: true });
    return run(function () {
      return ghRaw("pdfs/" + g.pdf, DRAFTS_REPO)
        .then(function (buf) { return putBytes("pdfs/" + g.pdf, REPO, buf, "Publish " + g.word + " PDF (from admin)"); })
        .then(function () {
          return updateJson(FILE, REPO, function (d) { d.guides = [entry].concat(without(d.guides, g.word)); }, "Activate " + g.word + " (from admin)");
        })
        .then(function () {
          return updateJson(DRAFTS_FILE, DRAFTS_REPO, function (d) { d.guides = without(d.guides, g.word); }, "Move " + g.word + " to live (from admin)");
        });
    }, g.word + " is going live. It'll show on the site in about a minute.");
  }

  /* Live → draft: keep a private copy of the PDF, move the entry back, remove the public PDF. */
  function deactivate(g, ch) {
    var entry = Object.assign(clean(g), ch, { active: false });
    return run(function () {
      return ghRaw("pdfs/" + g.pdf, REPO)
        .then(function (buf) { return putBytes("pdfs/" + g.pdf, DRAFTS_REPO, buf, "Keep " + g.word + " PDF private (from admin)"); })
        .then(function () {
          return updateJson(DRAFTS_FILE, DRAFTS_REPO, function (d) { d.guides = [entry].concat(without(d.guides, g.word)); }, "Move " + g.word + " back to drafts (from admin)");
        })
        .then(function () {
          return updateJson(FILE, REPO, function (d) { d.guides = without(d.guides, g.word); }, "Take " + g.word + " off the site (from admin)");
        })
        .then(function () { return deleteFile("pdfs/" + g.pdf, REPO, "Remove " + g.word + " PDF from the public site (from admin)"); });
    }, g.word + " is off the site and back in your private drafts.");
  }

  $("items").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-act]");
    if (!btn) return;
    var card = btn.closest(".item");
    var i = +card.getAttribute("data-i");
    var it = state.items[i], g = it.g, isLive = it.where === "live";
    var act = btn.getAttribute("data-act");

    if (act === "open") {
      if (isLive) { window.open("pdfs/" + encodeURI(g.pdf), "_blank", "noopener"); return; }
      var w = window.open("", "_blank");
      draftPdfUrl(g).then(function (url) { if (w) w.location = url; else location.href = url; })
        .catch(function (er) { if (w) w.close(); toast(er.message, 5000); });
      return;
    }
    if (act === "preview") {
      state.open[i] = !state.open[i];
      if (state.open[i] && !isLive && !state.blobs[g.word]) {
        toast("Loading PDF…", 8000);
        draftPdfUrl(g).then(function () { toast("PDF loaded.", 1200); render(); })
          .catch(function (er) { state.open[i] = false; toast(er.message, 5000); });
        return;
      }
      render(); return;
    }

    var f = readForm(card);
    var ch = { title: f.title, description: f.description, date: f.date };
    var reelInput = card.querySelector('[data-k="video"]');
    var hint = card.querySelector("[data-hint]");

    if (f.video) {
      var cl = cleanReel(f.video);
      if (!cl) {
        hint.textContent = "That doesn't look like an Instagram reel link. It should look like instagram.com/reel/…";
        hint.classList.add("bad"); reelInput.focus(); return;
      }
      ch.video = cl;
    } else {
      ch.video = "";
    }
    if (!ch.title) { toast("The title can't be empty."); return; }

    if (act === "on") {
      if (!ch.video) {
        hint.textContent = "Paste the Instagram reel link first. The guide goes live with its reel.";
        hint.classList.add("bad"); reelInput.focus(); return;
      }
      if (!ch.date) ch.date = today();
      activate(g, ch);
    } else if (act === "off") {
      if (!confirm("Take " + g.word + " off the live site? It goes back to your private drafts, and you can switch it on again any time.")) return;
      deactivate(g, ch);
    } else {
      (isLive ? saveLive : saveDraft)(g, ch);
    }
  });

  /* ---------- Filters ---------- */
  document.querySelector(".admin-tools .chips").addEventListener("click", function (e) {
    var c = e.target.closest(".chip"); if (!c) return;
    state.show = c.getAttribute("data-show");
    document.querySelectorAll(".admin-tools .chip").forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
    render();
  });

  $("q").addEventListener("input", function () { state.q = this.value.trim(); render(); });

  start();
})();
