/* ==================================================================
   TUI.JS — shared behaviour for every page
   ================================================================== */
(function(){
  "use strict";

  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------
     menu-bar clock
     --------------------------------------------------------------- */
  var clock = document.getElementById("clock");
  if (clock){
    (function tick(){
      var d = new Date(), h = d.getHours(), m = d.getMinutes();
      var ap = h < 12 ? "am" : "pm";
      h = h % 12; if (h === 0) h = 12;
      clock.textContent = h + ":" + (m < 10 ? "0" + m : m) + ap;
      setTimeout(tick, 20000);
    })();
  }

  /* ---------------------------------------------------------------
     easter-egg buttons: <button data-alert="...">
     --------------------------------------------------------------- */
  var alerts = document.querySelectorAll("[data-alert]");
  for (var a = 0; a < alerts.length; a++){
    alerts[a].addEventListener("click", function(){
      alert(this.getAttribute("data-alert"));
    });
  }

  /* ---------------------------------------------------------------
     TYPEWRITER
     Types the page out like it is printing to a terminal.

       data-typewriter="full"   type the whole panel
       data-typewriter="intro"  type the heading + opening paragraph,
                                then reveal the rest at once
       data-tw-defer            hide this until typing finishes

     Never runs under prefers-reduced-motion, and skips instantly on
     any click, keypress, scroll or touch. If JS never runs at all the
     page simply renders in full — nothing is hidden by CSS alone.
     --------------------------------------------------------------- */
  /* ---- typing speed dials -------------------------------------
     CPS is the average keystroke rate. A quick human typist sits
     around 20-30; the jitter and punctuation pauses below are what
     actually make it read as a person rather than a machine.
     ------------------------------------------------------------- */
  var CPS = 26;               // average characters per second
  var JITTER = 0.75;          // +/- variation per keystroke
  var PAUSE_SENTENCE = 300;   // extra ms after . ! ?
  var PAUSE_CLAUSE = 120;     // extra ms after , ; :
  var PAUSE_THINK = 200;      // occasional hesitation
  var THINK_CHANCE = 0.02;
  var MAX_FULL_CHARS = 1600;  // beyond this, "full" degrades to "intro"
  var SKIP_SELECTOR = ".tui-titlebar,.tui-closebox,.rule,.tui-menu,.tui-actions,.sysrow,.tui-menubar,.tui-statusbar";

  var skipTyping = null;   /* set while a typewriter is running */

  /* pages remember, for the length of the browser session, that they
     have already printed themselves once. Coming back to a page you
     have already read renders it in full immediately instead of
     re-typing it at you. Same idea as the boot sequence above. */
  function twKey(){
    return "s95tw:" + location.pathname;
  }
  function twSeen(){
    try { return sessionStorage.getItem(twKey()) === "1"; } catch(e){ return false; }
  }
  function twMarkSeen(){
    try { sessionStorage.setItem(twKey(), "1"); } catch(e){}
  }

  function initTypewriter(){
    var host = document.querySelector("[data-typewriter]");
    if (!host || REDUCE || twSeen() || prefs.typing === "off") return;
    twMarkSeen();

    var mode = host.getAttribute("data-typewriter") || "full";

    /* things that stay hidden until the typing is done */
    var deferred = [];
    var d = document.querySelectorAll(".tui-menu,.tui-actions,[data-tw-defer]");
    for (var i = 0; i < d.length; i++) deferred.push(d[i]);
    var pre = host.querySelectorAll(".cursor");   /* static cursors in the markup */
    for (var j = 0; j < pre.length; j++) deferred.push(pre[j]);

    /* collect the text nodes we intend to type, in document order */
    var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n){
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (n.parentElement && n.parentElement.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var items = [], node, total = 0;
    while ((node = walker.nextNode())){
      items.push({ node: node, text: node.nodeValue });
      total += node.nodeValue.length;
    }
    if (!items.length) return;

    if (mode === "full" && total > MAX_FULL_CHARS) mode = "intro";

    /* where to stop typing, and what to reveal afterwards */
    var cut = items.length, hidden = [];
    if (mode === "intro"){
      var firstP = host.querySelector("p");
      if (firstP){
        for (var k = items.length - 1; k >= 0; k--){
          if (firstP.contains(items[k].node)){ cut = k + 1; break; }
        }
        var el = firstP.nextElementSibling;
        while (el){
          if (!el.matches(".tui-actions")) hidden.push(el);
          el = el.nextElementSibling;
        }
      }
    }

    /* hide everything that should not be visible yet */
    var h;
    for (h = 0; h < hidden.length; h++) hidden[h].classList.add("tw-hide");
    for (h = 0; h < deferred.length; h++) deferred[h].classList.add("tw-hide");
    for (h = 0; h < cut; h++) items[h].node.nodeValue = "";

    var caret = document.createElement("span");
    caret.className = "cursor tw-caret";
    caret.setAttribute("aria-hidden", "true");

    var idx = 0, done = false, timer = null, hint = null;

    /* how long to wait before the next keystroke */
    function delayFor(ch){
      var d = (1000 / CPS) * (1 - JITTER / 2 + Math.random() * JITTER);
      if (ch === "." || ch === "!" || ch === "?") d += PAUSE_SENTENCE;
      else if (ch === "," || ch === ";" || ch === ":") d += PAUSE_CLAUSE;
      else if (Math.random() < THINK_CHANCE) d += PAUSE_THINK;
      return d;
    }

    function finish(){
      if (done) return;
      done = true;
      for (var f = 0; f < cut; f++) items[f].node.nodeValue = items[f].text;
      if (caret.parentNode) caret.parentNode.removeChild(caret);
      if (timer) clearTimeout(timer);
      if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
      for (var g = 0; g < hidden.length; g++) hidden[g].classList.remove("tw-hide");
      for (var q = 0; q < deferred.length; q++) deferred[q].classList.remove("tw-hide");
      host.removeAttribute("aria-busy");
      skipTyping = null;
      detach();
    }

    function detach(){
      document.removeEventListener("click", finish);
      document.removeEventListener("keydown", finish);
      document.removeEventListener("wheel", finish);
      document.removeEventListener("touchstart", finish);
    }

    document.addEventListener("click", finish);
    document.addEventListener("keydown", finish);
    document.addEventListener("wheel", finish, { passive: true });
    document.addEventListener("touchstart", finish, { passive: true });

    host.setAttribute("aria-busy", "true");
    skipTyping = finish;

    /* tell people they can skip — the nav is hidden until we finish */
    var bar = document.querySelector(".tui-statusbar");
    if (bar){
      hint = document.createElement("span");
      hint.className = "tw-skip";
      hint.innerHTML = '<b>ANY KEY</b> Skip';
      bar.insertBefore(hint, bar.firstChild);
    }

    function step(){
      if (done) return;

      /* advance past any finished node */
      while (idx < cut && items[idx].node.nodeValue.length >= items[idx].text.length) idx++;
      if (idx >= cut){ finish(); return; }

      var it = items[idx];
      var have = it.node.nodeValue.length;
      var ch = it.text.charAt(have);
      it.node.nodeValue = it.text.slice(0, have + 1);

      if (it.node.parentNode && caret.parentNode !== it.node.parentNode){
        it.node.parentNode.insertBefore(caret, it.node.nextSibling);
      }

      timer = setTimeout(step, delayFor(ch));
    }
    step();
  }

  /* ---------------------------------------------------------------
     MENU KEYBOARD NAVIGATION
     Arrow keys move the highlight through the buttons, Enter opens
     whatever is highlighted.

     Two shapes of page, and they want different things from Up/Down:

       .tui-menu     the home screen's grid of entries. The arrows own
                     the keyboard outright — there is nothing to read
                     past and nothing to scroll.

       .tui-actions  the row of buttons at the foot of an article.
                     Here the text is the point, so Up/Down keep
                     scrolling the page. Left/Right move the highlight
                     whenever you want it, and once you have scrolled
                     to the bottom a Down press drops you into the
                     button row. Up off the front of the row hands
                     scrolling back.

     Enter activates, Escape lets go. Typing in a field is left alone.
     --------------------------------------------------------------- */
  var forceReveal = function(){ if (skipTyping) skipTyping(); };

  function initMenuNav(){
    var menu = document.querySelector(".tui-menu");
    var nav = menu || document.querySelector(".tui-actions");
    if (!nav) return;

    /* the home grid owns the arrow keys; an article's row shares them */
    var ownsArrows = !!menu;

    var sel = -1;   /* our own selection state, independent of focus */

    function items(){
      return Array.prototype.slice.call(nav.querySelectorAll(".tui-btn"));
    }

    /* how many columns the grid is currently showing */
    function columns(){
      var t = getComputedStyle(nav).gridTemplateColumns;
      if (!t || t === "none") return 1;
      return t.trim().split(/\s+/).length;
    }

    /* nothing left to scroll? then Down has nowhere to go but the row.
       A page shorter than the window counts as already at the bottom. */
    function atBottom(){
      var doc = document.documentElement;
      var full = Math.max(doc.scrollHeight, document.body.scrollHeight);
      return (window.innerHeight + (window.pageYOffset || doc.scrollTop || 0)) >= full - 4;
    }

    function deselect(list){
      for (var i = 0; i < list.length; i++) list[i].classList.remove("is-selected");
      var act = document.activeElement;
      if (act && act.blur && nav.contains(act)){ try { act.blur(); } catch(e){} }
      sel = -1;
    }

    function select(list, j){
      for (var i = 0; i < list.length; i++) list[i].classList.remove("is-selected");
      sel = j;
      var el = list[j];
      if (!el) return;
      el.classList.add("is-selected");
      /* focus as well, for screen readers — but the highlight above is
         what people actually see, so this is allowed to fail */
      try { el.focus({ preventScroll: true }); } catch(e){ try { el.focus(); } catch(e2){} }
      /* on an article, Left/Right can pick the row while it is still
         off-screen, so bring it into view */
      if (!ownsArrows && el.scrollIntoView){
        try { el.scrollIntoView({ block: "nearest" }); } catch(e3){}
      }
    }

    /* clicking or hovering with a mouse clears the keyboard highlight */
    nav.addEventListener("mousedown", function(){
      var list = items();
      for (var i = 0; i < list.length; i++) list[i].classList.remove("is-selected");
      sel = -1;
    });

    document.addEventListener("keydown", function(e){
      if (navBlocked()) return;   /* a menu or a dialog is driving */
      var k = e.key;
      var isArrow = (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight");
      if (!isArrow && k !== "Home" && k !== "End" && k !== "Enter" && k !== "Escape") return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      /* typing in a field keeps normal cursor and submit behaviour */
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

      var list = items();
      if (!list.length) return;

      /* Enter opens whatever is selected. Activate it ourselves rather
         than relying on the browser doing it for a focused link. */
      if (k === "Enter"){
        if (sel < 0 || !list[sel]) return;
        e.preventDefault();
        list[sel].click();
        return;
      }

      if (k === "Escape"){
        if (sel >= 0){ e.preventDefault(); deselect(list); }
        return;
      }

      /* an arrow while the page is still printing reveals it first,
         so the very first press also lands on an item */
      forceReveal();
      list = items();
      if (!list.length) return;

      var n = list.length;
      var j;

      /* ---- home screen: the arrows are ours ---------------------- */
      if (ownsArrows){
        var cols = columns();

        if (sel < 0){
          j = (k === "ArrowUp" || k === "ArrowLeft" || k === "End") ? n - 1 : 0;
        } else if (k === "Home"){
          j = 0;
        } else if (k === "End"){
          j = n - 1;
        } else {
          var delta = (k === "ArrowRight") ?  1
                    : (k === "ArrowLeft")  ? -1
                    : (k === "ArrowDown")  ?  cols
                    :                       -cols;
          j = ((sel + delta) % n + n) % n;
        }

        e.preventDefault();
        select(list, j);
        return;
      }

      /* ---- article: Up/Down belong to the page first -------------- */

      /* Home and End stay with the browser — they jump the article */
      if (k === "Home" || k === "End"){ deselect(list); return; }

      if (k === "ArrowLeft" || k === "ArrowRight"){
        if (sel < 0) j = (k === "ArrowRight") ? 0 : n - 1;
        else         j = ((sel + (k === "ArrowRight" ? 1 : -1)) % n + n) % n;
        e.preventDefault();
        select(list, j);
        return;
      }

      if (k === "ArrowDown"){
        if (sel < 0){
          /* still reading: let the page scroll. Only when there is
             nothing left to scroll does Down enter the row. */
          if (!atBottom()) return;
          e.preventDefault();
          select(list, 0);
        } else {
          e.preventDefault();
          if (sel < n - 1) select(list, sel + 1);
        }
        return;
      }

      if (k === "ArrowUp"){
        /* off the front of the row: let go and let this same press
           scroll, so one key gets you back into the text */
        if (sel === 0){ deselect(list); return; }
        if (sel < 0) return;
        e.preventDefault();
        select(list, sel - 1);
        return;
      }
    });
  }

  /* ---------------------------------------------------------------
     BOOT SEQUENCE — only on pages that include #boot
     --------------------------------------------------------------- */
  function startBoot(boot){
    var seen = false;
    try { seen = sessionStorage.getItem("s95boot") === "1"; } catch(e){}

    function bootDone(){
      if (document.body.classList.contains("booted")) return;
      document.body.classList.add("booted");
      try { sessionStorage.setItem("s95boot","1"); } catch(e){}
      initTypewriter();
    }

    forceReveal = function(){ bootDone(); if (skipTyping) skipTyping(); };

    if (REDUCE || seen){ bootDone(); return; }

    /* [text, ms to hold before the next line] — a longer power-on
       self test, roughly four and a half seconds end to end */
    var lines = [
      ["Gospel95 BIOS v1.03  (C) 1995",            320],
      ["",                                          120],
      ["CPU     : 486DX2  66 MHz",                  240],
      ["Memory Test : 640K",                        400],
      ["Memory Test : 640K OK",                     300],
      ["",                                          160],
      ["Detecting IDE drives ...",                  440],
      ["  Primary Master  : GOSPEL95 HDD",          250],
      ["  Primary Slave   : None",                  200],
      ["Detecting serial ports  ... COM1 COM2",     240],
      ["Detecting parallel ports ... LPT1",         240],
      ["",                                          170],
      ["Verifying DMI pool data ...",               480],
      ["Loading GOSPEL95.EXE ...",                  540],
      ["",                                          100]
    ];
    var li = 0;
    boot.addEventListener("click", bootDone);
    document.addEventListener("keydown", function once(){
      document.removeEventListener("keydown", once); bootDone();
    });
    (function next(){
      if (document.body.classList.contains("booted")) return;
      if (li >= lines.length){ setTimeout(bootDone, 240); return; }
      var line = lines[li++];
      /* the second Memory Test line overwrites the first, the way a
         real POST counts up in place */
      if (line[0].indexOf("Memory Test") === 0 && li > 1 &&
          lines[li - 2][0].indexOf("Memory Test") === 0){
        boot.textContent = boot.textContent.replace(/Memory Test : 640K\n$/, "");
      }
      boot.textContent += line[0] + "\n";
      setTimeout(next, line[1]);
    })();
  }

  /* ---------------------------------------------------------------
     PREFERENCES
     Colour scheme, scanlines, typing and text size. Remembered in
     localStorage, stamped on <html> so the CSS can act on them.
     Private browsing can refuse storage, so every read has a default
     and every write is allowed to fail.
     --------------------------------------------------------------- */
  var PREF_KEY = "g95prefs";
  var prefs = { scheme:"blue", scanlines:"on", typing:"on", size:1 };

  function loadPrefs(){
    var raw = null;
    try { raw = localStorage.getItem(PREF_KEY); } catch(e){}
    if (!raw) return;
    try {
      var got = JSON.parse(raw);
      for (var k in prefs) if (got && got[k] != null) prefs[k] = got[k];
    } catch(e){}
  }

  function savePrefs(){
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch(e){}
  }

  function applyPrefs(){
    var root = document.documentElement;
    if (prefs.scheme && prefs.scheme !== "blue") root.setAttribute("data-scheme", prefs.scheme);
    else root.removeAttribute("data-scheme");
    root.setAttribute("data-scanlines", prefs.scanlines === "off" ? "off" : "on");
    var f = Number(prefs.size) || 1;
    if (f !== 1) root.style.setProperty("--cell", "calc(clamp(11px, 2.6vw, 16px) * " + f + ")");
    else root.style.removeProperty("--cell");
  }

  function setPref(k, v){ prefs[k] = v; savePrefs(); applyPrefs(); }

  loadPrefs();
  applyPrefs();

  /* ---------------------------------------------------------------
     DIALOGS
     One DOS window in the middle of the screen. Esc closes, focus is
     kept inside while it is open, and the page behind is inert.
     --------------------------------------------------------------- */
  var modalStack = [];

  function esc(str){
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;")
                      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function el(tag, cls, html){
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* opts: {title, wide, build(body, api), buttons:[{label,hot,act}], onKey(e,api)} */
  function openDialog(opts){
    var overlay = el("div", "tui-overlay");
    var dlg = el("div", "tui-dialog" + (opts.wide ? " tui-dialog--wide" : ""));
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-label", opts.title || "Dialog");

    var bar = el("div", "tui-titlebar", esc(opts.title || ""));
    var body = el("div", "tui-dbody");
    dlg.appendChild(bar);
    dlg.appendChild(body);

    var api = {
      overlay: overlay, dialog: dlg, body: body,
      close: function(){ closeDialog(api); },
      setTitle: function(t){ bar.innerHTML = esc(t); }
    };

    var foot = el("div", "tui-dfoot");
    var buttons = opts.buttons || [{ label:"CLOSE" }];
    buttons.forEach(function(b){
      var btn = el("button", "tui-btn", '<span class="brk">[</span> ' + esc(b.label) + ' <span class="brk">]</span>');
      btn.type = "button";
      btn.addEventListener("click", function(){
        if (b.act) b.act(api); else api.close();
      });
      foot.appendChild(btn);
    });
    dlg.appendChild(foot);

    overlay.appendChild(dlg);
    overlay.addEventListener("mousedown", function(e){ if (e.target === overlay) api.close(); });

    api.onKey = opts.onKey || null;
    document.body.appendChild(overlay);
    modalStack.push(api);

    if (opts.build) opts.build(body, api);

    /* focus the first thing worth typing into, else the dialog */
    var first = dlg.querySelector("input,textarea,select,button,a[href]");
    try { (first || dlg).focus({ preventScroll:true }); } catch(e){ }
    return api;
  }

  function closeDialog(api){
    var i = modalStack.indexOf(api);
    if (i === -1) return;
    modalStack.splice(i, 1);
    if (api.overlay.parentNode) api.overlay.parentNode.removeChild(api.overlay);
    if (api.onClose) api.onClose();
    var next = modalStack[modalStack.length - 1];
    if (next){ try { next.dialog.focus({ preventScroll:true }); } catch(e){} }
  }

  function topModal(){ return modalStack[modalStack.length - 1] || null; }

  /* Esc closes, Tab stays inside, and a dialog's own handler gets a look */
  document.addEventListener("keydown", function(e){
    var m = topModal();
    if (!m) return;
    if (m.onKey && m.onKey(e, m) === true) return;
    if (e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); m.close(); return; }
    if (e.key === "Tab"){
      var f = m.dialog.querySelectorAll("input,textarea,select,button,a[href]");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  }, true);

  /* a small message box, for the short answers */
  function say(title, html, buttons){
    return openDialog({
      title: title,
      build: function(body){ body.innerHTML = html; },
      buttons: buttons
    });
  }

  /* ---------------------------------------------------------------
     THE SCRIPTURES
     kjv.json is the whole King James Bible, 31,102 verses, about
     1.2 MB over the wire once gzipped. It is fetched the first time
     somebody actually searches, never on page load, and then kept in
     memory for the rest of the visit.

     The site quotes Young's Literal, but YLT says "age-during" where
     everyone types "everlasting" — searching it would look broken.
     So the search runs against the KJV, whose words match what people
     put in the box. Both are public domain.
     --------------------------------------------------------------- */
  var BIBLE = null;        /* [ [name, [ [verse,...], ... ] ], ... ] */
  var FLAT = null;         /* [ [book, chapter, verse, text], ... ]  */
  var bibleWait = null;

  function loadBible(){
    if (BIBLE) return Promise.resolve(BIBLE);
    if (bibleWait) return bibleWait;
    bibleWait = fetch("kjv.json").then(function(r){
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function(data){
      BIBLE = data.books;
      FLAT = [];
      for (var b = 0; b < BIBLE.length; b++){
        var name = BIBLE[b][0], chapters = BIBLE[b][1];
        for (var c = 0; c < chapters.length; c++){
          var verses = chapters[c];
          for (var v = 0; v < verses.length; v++) FLAT.push([name, c + 1, v + 1, verses[v]]);
        }
      }
      return BIBLE;
    }).catch(function(err){
      bibleWait = null;
      throw err;
    });
    return bibleWait;
  }

  /* -- references ------------------------------------------------- */
  var NUMWORD = { "1":"1", "1st":"1", "first":"1", "i":"1",
                  "2":"2", "2nd":"2", "second":"2", "ii":"2",
                  "3":"3", "3rd":"3", "third":"3", "iii":"3" };
  var ALIAS = {
    "ps":"Psalms", "psalm":"Psalms", "pss":"Psalms",
    "song":"Song of Solomon", "songs":"Song of Solomon",
    "song of songs":"Song of Solomon", "canticles":"Song of Solomon",
    "rev":"Revelation", "apocalypse":"Revelation",
    "mt":"Matthew", "mk":"Mark", "lk":"Luke", "jn":"John", "jhn":"John",
    "phlm":"Philemon", "philem":"Philemon", "phm":"Philemon",
    "php":"Philippians", "phip":"Philippians",
    "jas":"James", "gen":"Genesis", "ex":"Exodus", "lev":"Leviticus",
    "num":"Numbers", "deut":"Deuteronomy", "dt":"Deuteronomy",
    "eccl":"Ecclesiastes", "qoheleth":"Ecclesiastes",
    "acts of the apostles":"Acts",
    "revelation of john":"Revelation", "sos":"Song of Solomon",
    "thess":"Thessalonians", "chron":"Chronicles", "sam":"Samuel"
  };

  function normName(s){
    return String(s).toLowerCase().replace(/\./g, " ").replace(/\s+/g, " ").trim();
  }

  function bookNames(){
    return BIBLE ? BIBLE.map(function(b){ return b[0]; }) : [];
  }

  function findBook(raw){
    if (!BIBLE) return null;
    var n = normName(raw);
    if (!n) return null;
    /* "first john", "i john", "1 jn" all mean the same shelf. Take the
       numeral off the front first, so the rest can go through the
       abbreviation table on its own and be put back after. */
    var num = "";
    var lead = n.match(/^(1|2|3|1st|2nd|3rd|first|second|third|i{1,3})\s+(.*)$/);
    if (lead && NUMWORD[lead[1]]){ num = NUMWORD[lead[1]] + " "; n = lead[2]; }
    if (ALIAS[n]) n = normName(ALIAS[n]);
    n = (num + n).trim();

    var names = bookNames(), i;
    for (i = 0; i < names.length; i++) if (normName(names[i]) === n) return names[i];
    /* unique-ish prefix: "gen", "rom", "reve" */
    for (i = 0; i < names.length; i++) if (normName(names[i]).indexOf(n) === 0) return names[i];
    /* last resort: drop spaces, so "songofsolomon" still lands */
    var tight = n.replace(/ /g, "");
    for (i = 0; i < names.length; i++) if (normName(names[i]).replace(/ /g,"") === tight) return names[i];
    return null;
  }

  /* "John 3:16", "john 3", "1 Jn 4:7-12", "Ps 23" */
  function parseRef(str){
    var m = String(str).trim().match(/^([1-3]|i{1,3}|first|second|third)?\s*([a-z][a-z .']*?)\s*(\d+)\s*(?::\s*(\d+)\s*(?:[-–]\s*(\d+))?)?\s*$/i);
    if (!m) return null;
    var book = findBook(((m[1] || "") + " " + m[2]).trim());
    if (!book) return null;
    return { book: book, chapter: +m[3], verse: m[4] ? +m[4] : null, to: m[5] ? +m[5] : null };
  }

  function chapterOf(book, chapter){
    if (!BIBLE) return null;
    for (var i = 0; i < BIBLE.length; i++)
      if (BIBLE[i][0] === book) return BIBLE[i][1][chapter - 1] || null;
    return null;
  }

  function chapterCount(book){
    for (var i = 0; i < BIBLE.length; i++) if (BIBLE[i][0] === book) return BIBLE[i][1].length;
    return 0;
  }

  /* -- searching --------------------------------------------------- */
  /* "quoted phrase" is taken whole; otherwise every word must appear */
  function parseTerms(q){
    var terms = [], re = /"([^"]+)"|(\S+)/g, m;
    while ((m = re.exec(q))) terms.push((m[1] || m[2]).toLowerCase());
    return terms.filter(function(t){ return t.length > 0; });
  }

  function searchScriptures(q, limit){
    var terms = parseTerms(q), out = [], truncated = false;
    if (!terms.length) return { hits: out, terms: terms, truncated: false, total: 0 };
    var total = 0;
    for (var i = 0; i < FLAT.length; i++){
      var text = FLAT[i][3].toLowerCase(), ok = true;
      for (var t = 0; t < terms.length; t++){
        if (text.indexOf(terms[t]) === -1){ ok = false; break; }
      }
      if (!ok) continue;
      total++;
      if (out.length < limit) out.push(FLAT[i]);
      else truncated = true;
    }
    return { hits: out, terms: terms, truncated: truncated, total: total };
  }

  function markTerms(text, terms){
    var html = esc(text);
    if (!terms || !terms.length) return html;
    /* longest first, so "everlasting life" wins over "life" */
    var sorted = terms.slice().sort(function(a,b){ return b.length - a.length; });
    sorted.forEach(function(t){
      var safe = esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp("(" + safe + ")(?![^<]*>)", "gi"), "<mark>$1</mark>");
    });
    return html;
  }

  /* ---------------------------------------------------------------
     SEARCH DIALOG
     One box takes both kinds of question: type words to search the
     text, or a reference like "John 3:16" to go straight there.
     --------------------------------------------------------------- */
  var MAX_HITS = 300;

  function openSearch(prefill){
    var input, note, results, hits = [], hitSel = -1;

    var api = openDialog({
      title: "C:\\BIBLE\\SEARCH.EXE",
      wide: true,
      buttons: [
        { label:"SEARCH", act: function(){ run(); } },
        { label:"CLOSE" }
      ],
      onKey: function(e){
        if (e.key === "ArrowDown" || e.key === "ArrowUp"){
          if (!hits.length) return false;
          e.preventDefault();
          moveHit(e.key === "ArrowDown" ? 1 : -1);
          return true;
        }
        if (e.key === "Enter"){
          e.preventDefault();
          if (hitSel >= 0 && hits[hitSel]) openPassage(hits[hitSel][0], hits[hitSel][1], hits[hitSel][2]);
          else run();
          return true;
        }
        return false;
      },
      build: function(body){
        var field = el("div", "tui-field");
        field.innerHTML = '<label for="g95q">FIND:</label>';
        input = el("input", "tui-input");
        input.type = "text";
        input.id = "g95q";
        input.autocomplete = "off";
        input.setAttribute("spellcheck", "false");
        input.placeholder = 'a word, or a reference like John 3:16';
        field.appendChild(input);
        body.appendChild(field);

        note = el("div", "tui-note", "Loading the Scriptures \u2014 about 1.2 MB, once per visit \u2026");
        body.appendChild(note);

        results = el("div", "tui-results");
        body.appendChild(results);

        loadBible().then(function(){
          note.innerHTML = "King James Version \u2014 " + FLAT.length.toLocaleString() +
                           " verses ready. Type words to search, or a reference to go straight there.";
          input.disabled = false;
          try { input.focus(); } catch(e){}
          if (prefill){ input.value = prefill; run(); }
        }).catch(function(){
          note.innerHTML = '<span style="color:var(--dos-red)">Could not load kjv.json. ' +
                           'Check your connection and try again.</span>';
        });

        input.disabled = true;
        input.addEventListener("keydown", function(e){
          if (e.key === "Enter"){ e.preventDefault(); e.stopPropagation(); run(); }
        });
      }
    });

    function moveHit(d){
      var nodes = results.querySelectorAll(".tui-hit");
      if (!nodes.length) return;
      if (hitSel >= 0 && nodes[hitSel]) nodes[hitSel].classList.remove("is-selected");
      hitSel = (hitSel + d + nodes.length) % nodes.length;
      nodes[hitSel].classList.add("is-selected");
      try { nodes[hitSel].scrollIntoView({ block:"nearest" }); } catch(e){}
    }

    function run(){
      if (!FLAT) return;
      var q = input.value.trim();
      hits = []; hitSel = -1; results.innerHTML = "";
      if (!q) return;

      /* a reference wins: "John 3:16" is a destination, not a word */
      var ref = parseRef(q);
      if (ref){ openPassage(ref.book, ref.chapter, ref.verse, ref.to); return; }

      var found = searchScriptures(q, MAX_HITS);
      if (!found.total){
        results.innerHTML = '<p class="tui-note">No verse contains that. ' +
          'Try fewer words, or put a phrase in "quotation marks".</p>';
        return;
      }
      hits = found.hits;
      note.innerHTML = found.total.toLocaleString() + " verse" + (found.total === 1 ? "" : "s") +
        " found" + (found.truncated ? " \u2014 first " + MAX_HITS + " shown" : "") +
        ". \u2191\u2193 to move, ENTER to open.";

      found.hits.forEach(function(h){
        var btn = el("button", "tui-hit");
        btn.type = "button";
        btn.innerHTML = '<span class="ref">' + esc(h[0] + " " + h[1] + ":" + h[2]) + '</span> ' +
                        markTerms(h[3], found.terms);
        btn.addEventListener("click", function(){ openPassage(h[0], h[1], h[2]); });
        results.appendChild(btn);
      });
    }

    return api;
  }

  /* the chapter, with the verse you asked for lit up */
  function openPassage(book, chapter, verse, to){
    var verses = chapterOf(book, chapter);
    if (!verses){
      say("NOT FOUND", "<p>" + esc(book + " " + chapter) + " is not in this Bible.</p>");
      return;
    }
    var last = chapterCount(book);

    openDialog({
      title: (book + " " + chapter).toUpperCase(),
      wide: true,
      buttons: [
        { label:"\u2190 PREV", act: function(api){
            api.close();
            if (chapter > 1) openPassage(book, chapter - 1);
            else openPassage(book, 1);
          } },
        { label:"NEXT \u2192", act: function(api){
            api.close();
            openPassage(book, Math.min(chapter + 1, last));
          } },
        { label:"CLOSE" }
      ],
      build: function(body){
        var hi = null;
        verses.forEach(function(text, i){
          var n = i + 1;
          var lit = verse && (n === verse || (to && n >= verse && n <= to));
          var row = el("p", "tui-verse");
          row.innerHTML = '<span class="ref">' + book + " " + chapter + ":" + n + '</span>' +
                          (lit ? "<mark>" + esc(text) + "</mark>" : esc(text));
          if (lit && !hi) hi = row;
          body.appendChild(row);
        });
        if (hi) setTimeout(function(){
          try { hi.scrollIntoView({ block:"center" }); } catch(e){}
        }, 30);
      }
    });
  }

  /* ---------------------------------------------------------------
     FIND IN PAGE
     Marks matches in the article itself and steps between them.
     --------------------------------------------------------------- */
  var findMarks = [], findAt = -1;

  function clearFind(){
    findMarks = []; findAt = -1;
    var marks = document.querySelectorAll("mark.tui-found");
    for (var i = 0; i < marks.length; i++){
      var m = marks[i], p = m.parentNode;
      if (!p) continue;
      p.replaceChild(document.createTextNode(m.textContent), m);
      p.normalize();
    }
  }

  function findInPage(term){
    clearFind();
    if (!term) return 0;
    var host = document.querySelector(".prose") || document.querySelector(".tui-panel") || document.body;
    var needle = term.toLowerCase();

    var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n){
        if (!n.nodeValue || n.nodeValue.toLowerCase().indexOf(needle) === -1) return NodeFilter.FILTER_REJECT;
        if (n.parentElement && n.parentElement.closest("script,style,.tui-overlay,.tui-menubar,.tui-statusbar"))
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var targets = [], node;
    while ((node = walker.nextNode())) targets.push(node);

    targets.forEach(function(t){
      var text = t.nodeValue, low = text.toLowerCase(), at = 0, frag = document.createDocumentFragment(), i;
      while ((i = low.indexOf(needle, at)) !== -1){
        if (i > at) frag.appendChild(document.createTextNode(text.slice(at, i)));
        var m = el("mark", "tui-found");
        m.textContent = text.slice(i, i + needle.length);
        frag.appendChild(m);
        findMarks.push(m);
        at = i + needle.length;
      }
      if (at < text.length) frag.appendChild(document.createTextNode(text.slice(at)));
      if (t.parentNode) t.parentNode.replaceChild(frag, t);
    });
    return findMarks.length;
  }

  function stepFind(d){
    if (!findMarks.length) return;
    if (findAt >= 0 && findMarks[findAt]) findMarks[findAt].classList.remove("is-current");
    findAt = (findAt + d + findMarks.length) % findMarks.length;
    var m = findMarks[findAt];
    m.classList.add("is-current");
    try { m.scrollIntoView({ block:"center" }); } catch(e){}
  }

  function openFind(){
    if (skipTyping) skipTyping();   /* cannot search text that is still printing */
    var input, note;
    openDialog({
      title: "FIND IN PAGE",
      buttons: [
        { label:"NEXT", act: function(){ stepFind(1); } },
        { label:"PREV", act: function(){ stepFind(-1); } },
        { label:"DONE", act: function(api){ clearFind(); api.close(); } }
      ],
      build: function(body, api){
        var field = el("div", "tui-field");
        field.innerHTML = '<label for="g95f">FIND:</label>';
        input = el("input", "tui-input");
        input.type = "text"; input.id = "g95f"; input.autocomplete = "off";
        field.appendChild(input);
        body.appendChild(field);
        note = el("div", "tui-note", "Type to highlight. ENTER steps through.");
        body.appendChild(note);

        input.addEventListener("input", function(){
          var n = findInPage(input.value.trim());
          note.textContent = !input.value.trim() ? "Type to highlight. ENTER steps through."
            : n ? n + " match" + (n === 1 ? "" : "es") + " on this page. ENTER steps through."
                : "Nothing on this page matches that.";
          if (n) stepFind(1);
        });
        input.addEventListener("keydown", function(e){
          if (e.key === "Enter"){ e.preventDefault(); e.stopPropagation(); stepFind(e.shiftKey ? -1 : 1); }
        });
        api.onClose = clearFind;
      }
    });
  }

  /* ---------------------------------------------------------------
     ODDS AND ENDS behind the menu items
     --------------------------------------------------------------- */
  function pageText(){
    var host = document.querySelector(".prose") || document.querySelector(".tui-panel") || document.body;
    return (host.innerText || host.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  }

  function copyText(str, okMsg){
    function fallback(){
      var ta = el("textarea");
      ta.value = str;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch(e){}
      document.body.removeChild(ta);
      say(ok ? "COPIED" : "COPY FAILED",
          "<p>" + (ok ? esc(okMsg) : "This browser would not let the page copy for you. Select the text and copy it yourself.") + "</p>");
    }
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(str).then(function(){
        say("COPIED", "<p>" + esc(okMsg) + "</p>");
      }).catch(fallback);
    } else fallback();
  }

  function saveAsText(){
    var name = (document.title || "page").replace(/[^A-Za-z0-9]+/g, "-").toUpperCase().slice(0, 8) || "PAGE";
    var blob = new Blob([pageText() + "\n"], { type:"text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = el("a");
    a.href = url; a.download = name + ".TXT";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  }

  function exitScreen(){
    var s = el("div", "tui-exit");
    s.innerHTML = '<div><p>It is now safe to turn off your computer.</p>' +
                  '<p style="margin-top:1.4em"><b>[ PRESS ANY KEY TO RETURN ]</b></p></div>';
    document.body.appendChild(s);
    function back(){
      if (s.parentNode) s.parentNode.removeChild(s);
      document.removeEventListener("keydown", back);
      s.removeEventListener("click", back);
    }
    setTimeout(function(){
      document.addEventListener("keydown", back);
      s.addEventListener("click", back);
    }, 250);
  }

  var VOTD = ["John 3:16","Psalms 23:1","Romans 5:8","Romans 6:23","Romans 8:1","Romans 8:28",
    "Ephesians 2:8","Isaiah 53:5","Isaiah 40:31","Proverbs 3:5","Philippians 4:6","Matthew 11:28",
    "Joshua 1:9","Psalms 46:1","Psalms 119:105","1 John 1:9","2 Corinthians 5:17","Galatians 2:20",
    "Hebrews 11:1","Hebrews 4:16","James 1:5","1 Peter 5:7","Micah 6:8","Lamentations 3:22",
    "Zephaniah 3:17","John 14:6","Acts 4:12","Titus 3:5","1 Corinthians 15:3","Genesis 1:1",
    "Psalms 51:10","Matthew 28:19","Colossians 3:23","John 1:12","Ephesians 2:10"];

  function verseOfTheDay(){
    loadBible().then(function(){
      var now = new Date();
      var day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
      var ref = parseRef(VOTD[day % VOTD.length]) || parseRef("John 3:16");
      var verses = chapterOf(ref.book, ref.chapter);
      var text = verses && verses[ref.verse - 1];
      say("VERSE OF THE DAY",
        '<p class="tui-verse"><span class="ref">' + esc(ref.book + " " + ref.chapter + ":" + ref.verse) +
        '</span>' + esc(text || "") + "</p>" +
        '<p class="tui-note">King James Version</p>',
        [{ label:"READ THE CHAPTER", act: function(api){ api.close(); openPassage(ref.book, ref.chapter, ref.verse); } },
         { label:"CLOSE" }]);
    }).catch(function(){
      say("VERSE OF THE DAY", "<p>Could not load the Scriptures just now.</p>");
    });
  }

  function startReading(){
    var picks = [
      ["John", "The plainest account of who Jesus is. Start here if you start anywhere."],
      ["Mark", "The shortest gospel, and the fastest moving."],
      ["Genesis", "Where it all opens, and where most of the rest is rooted."],
      ["Psalms", "For when you need words and have none of your own."],
      ["Romans", "The argument laid out end to end."],
      ["Proverbs", "A chapter a day, thirty-one of them, one for each of the month."]
    ];
    openDialog({
      title: "WHERE TO START",
      build: function(body){
        body.appendChild(el("p", null, "There is no wrong door, but some are easier to open than others."));
        picks.forEach(function(p){
          var b = el("button", "tui-hit");
          b.type = "button";
          b.innerHTML = '<span class="ref">' + esc(p[0]) + "</span> " + esc(p[1]);
          b.addEventListener("click", function(){ openPassage(p[0], 1); });
          body.appendChild(b);
        });
      }
    });
  }

  function systemInfo(){
    var names = { blue:"DOS Blue", amber:"Amber", green:"Green Phosphor", mono:"Monochrome" };
    say("SYSTEM INFORMATION",
      "<p>MACHINE&nbsp;&nbsp;&nbsp; GOSPEL 95</p>" +
      "<p>DISPLAY&nbsp;&nbsp;&nbsp; " + esc(names[prefs.scheme] || "DOS Blue") + "</p>" +
      "<p>SCANLINES&nbsp; " + (prefs.scanlines === "off" ? "OFF" : "ON") + "</p>" +
      "<p>TYPING&nbsp;&nbsp;&nbsp;&nbsp; " + (prefs.typing === "off" ? "OFF" : "ON") + "</p>" +
      "<p>TEXT SIZE&nbsp; " + Math.round((Number(prefs.size) || 1) * 100) + "%</p>" +
      "<p>SCREEN&nbsp;&nbsp;&nbsp;&nbsp; " + window.innerWidth + " x " + window.innerHeight + "</p>" +
      "<p>SCRIPTURE&nbsp; " + (FLAT ? FLAT.length.toLocaleString() + " verses in memory" : "not loaded") + "</p>" +
      "<p>PAGE&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; " + esc(location.pathname.replace(/^\//, "") || "index.html") + "</p>");
  }

  /* ---------------------------------------------------------------
     THE MENUS
     Built by script into the bar that was decoration until now, so
     no page has to carry the markup. Without JS the bar simply reads
     as the label strip it always was.
     --------------------------------------------------------------- */
  var SEP = { sep:true };

  function go(href){ return function(){ location.href = href; }; }

  var MENUS = [
    { label:"File", hot:"F", items: function(){ return [
      { label:"Home",             hot:"H", act: go("index.html") },
      { label:"Bio",              hot:"B", act: go("bio.html") },
      { label:"The Gospel",       hot:"G", act: go("gospel.html") },
      { label:"Send a Message",   hot:"S", act: go("message.html") },
      { label:"Prayer Request",   hot:"P", act: go("prayer.html") },
      SEP,
      { label:"Print\u2026",      hot:"R", act: function(){ window.print(); } },
      { label:"Save as Text\u2026", hot:"A", act: saveAsText },
      SEP,
      { label:"Exit",             hot:"X", accel:"F10", act: exitScreen }
    ]; } },

    { label:"Edit", hot:"E", items: function(){ return [
      { label:"Undo",  hot:"U", act: function(){
          say("UNDO", "<p>Some things cannot be undone.</p>" +
                      "<p>That is why you need a Saviour.</p>",
              [{ label:"THE GOSPEL", act: go("gospel.html") }, { label:"CLOSE" }]);
        } },
      { label:"Redo",  hot:"R", disabled:true },
      SEP,
      { label:"Cut",   hot:"T", disabled:true },
      { label:"Copy",  hot:"C", act: function(){
          var sel = String(window.getSelection ? window.getSelection() : "");
          copyText(sel || pageText(), sel ? "Selection copied." : "The whole page is on the clipboard.");
        } },
      { label:"Paste", hot:"P", disabled:true },
      SEP,
      { label:"Select All",       hot:"L", act: function(){
          var host = document.querySelector(".prose") || document.querySelector(".tui-panel");
          if (!host || !window.getSelection) return;
          var r = document.createRange();
          r.selectNodeContents(host);
          var s = window.getSelection();
          s.removeAllRanges(); s.addRange(r);
        } },
      { label:"Find in Page\u2026", hot:"F", act: openFind }
    ]; } },

    { label:"Search", hot:"S", items: function(){ return [
      { label:"Search the Scriptures\u2026", hot:"S", accel:"F2", act: function(){ openSearch(); } },
      { label:"Go to Verse\u2026",           hot:"G", act: function(){ openSearch(""); } },
      { label:"Verse of the Day",            hot:"V", act: verseOfTheDay },
      SEP,
      { label:"Find in Page\u2026",          hot:"F", act: openFind }
    ]; } },

    { label:"View", hot:"V", items: function(){
      function scheme(id, label, hot){
        return { label:label, hot:hot, mark: prefs.scheme === id ? "\u2022" : " ",
                 act: function(){ setPref("scheme", id); } };
      }
      return [
        scheme("blue",  "DOS Blue",       "D"),
        scheme("amber", "Amber",          "A"),
        scheme("green", "Green Phosphor", "G"),
        scheme("mono",  "Monochrome",     "M"),
        SEP,
        { label:"Scanlines", hot:"S", mark: prefs.scanlines === "off" ? " " : "x",
          act: function(){ setPref("scanlines", prefs.scanlines === "off" ? "on" : "off"); } },
        { label:"Typing Animation", hot:"T", mark: prefs.typing === "off" ? " " : "x",
          act: function(){ setPref("typing", prefs.typing === "off" ? "on" : "off"); } },
        SEP,
        { label:"Larger Text",  hot:"L", act: function(){ setPref("size", Math.min((Number(prefs.size)||1) + 0.1, 1.6)); } },
        { label:"Smaller Text", hot:"E", act: function(){ setPref("size", Math.max((Number(prefs.size)||1) - 0.1, 0.8)); } },
        { label:"Normal Text",  hot:"N", act: function(){ setPref("size", 1); } },
        SEP,
        { label:"System Information", hot:"I", act: systemInfo }
      ];
    } },

    { label:"Help", hot:"H", items: function(){ return [
      { label:"About Gospel 95", hot:"A", accel:"F1", act: function(){
          say("ABOUT", "<h2>Gospel 95</h2>" +
            "<p>A personal site dressed as a machine from 1995, because the " +
            "message on it is older than either.</p>" +
            "<p class=\"tui-note\">Scripture search: King James Version, 31,102 verses. " +
            "Quotations on the pages: Young's Literal Translation. Both public domain.</p>");
        } },
      { label:"Keyboard Shortcuts", hot:"K", act: function(){
          say("KEYBOARD",
            "<p><b>\u2191 \u2193 \u2190 \u2192</b> &nbsp; move the selection</p>" +
            "<p><b>ENTER</b> &nbsp; open what is selected</p>" +
            "<p><b>ESC</b> &nbsp; close a menu or a window</p>" +
            "<p><b>F1</b> &nbsp; about this site</p>" +
            "<p><b>F2</b> &nbsp; search the Scriptures</p>" +
            "<p><b>F10</b> &nbsp; exit</p>" +
            "<p><b>ALT</b> + the red letter opens a menu</p>" +
            "<p class=\"tui-note\">On an article, \u2191\u2193 scroll until you reach the " +
            "bottom, and then step into the buttons.</p>");
        } },
      SEP,
      { label:"What Is the Gospel?", hot:"W", act: go("gospel.html") },
      { label:"Where to Start Reading", hot:"R", act: startReading },
      SEP,
      { label:"Credits", hot:"C", act: function(){
          say("CREDITS",
            "<p>Type: IBM Plex Mono.</p>" +
            "<p>Scripture text: King James Version and Young's Literal Translation, " +
            "both in the public domain, by way of the scrollmapper Bible databases.</p>" +
            "<p>Everything else hand-built. No frameworks were harmed.</p>");
        } }
    ]; } }
  ];

  var openMenu = null;       /* the .tui-mwrap currently showing */
  var menuSel = -1;

  function navBlocked(){ return !!openMenu || modalStack.length > 0; }

  function menuItems(wrap){
    return Array.prototype.slice.call(wrap.querySelectorAll(".tui-mi:not(:disabled)"));
  }

  function closeMenu(){
    if (!openMenu) return;
    var drop = openMenu.querySelector(".tui-dropdown");
    var root = openMenu.querySelector(".tui-mroot");
    if (drop) drop.hidden = true;
    if (root) root.setAttribute("aria-expanded", "false");
    openMenu = null;
    menuSel = -1;
  }

  function hotHtml(label, hot){
    if (!hot) return esc(label);
    var i = label.toLowerCase().indexOf(hot.toLowerCase());
    if (i === -1) return esc(label);
    return esc(label.slice(0, i)) + '<span class="key">' + esc(label.slice(i, i + 1)) +
           "</span>" + esc(label.slice(i + 1));
  }

  function openMenuAt(wrap){
    if (openMenu === wrap) { closeMenu(); return; }
    closeMenu();
    var drop = wrap.querySelector(".tui-dropdown");
    var root = wrap.querySelector(".tui-mroot");
    var spec = wrap._spec;

    /* rebuilt every time, so the ticks and dots show what is true now */
    drop.innerHTML = "";
    spec.items().forEach(function(it){
      if (it.sep){ drop.appendChild(el("div", "tui-msep")); return; }
      var b = el("button", "tui-mi");
      b.type = "button";
      if (it.disabled) b.disabled = true;
      b.innerHTML = '<span class="mark">' + esc(it.mark || " ") + "</span>" +
                    '<span class="label">' + hotHtml(it.label, it.hot) + "</span>" +
                    '<span class="accel">' + esc(it.accel || "") + "</span>";
      if (it.hot) b.setAttribute("data-hot", it.hot.toLowerCase());
      if (!it.disabled) b.addEventListener("click", function(){
        closeMenu();
        if (it.act) it.act();
      });
      drop.appendChild(b);
    });

    drop.hidden = false;
    drop.style.left = "0";
    root.setAttribute("aria-expanded", "true");
    openMenu = wrap;
    menuSel = -1;

    /* keep it on screen on a narrow phone */
    var box = drop.getBoundingClientRect();
    var over = box.right - (window.innerWidth - 4);
    if (over > 0) drop.style.left = (-over) + "px";
  }

  function moveMenuSel(d){
    if (!openMenu) return;
    var list = menuItems(openMenu);
    if (!list.length) return;
    if (menuSel >= 0 && list[menuSel]) list[menuSel].classList.remove("is-selected");
    menuSel = (menuSel + d + list.length) % list.length;
    list[menuSel].classList.add("is-selected");
    try { list[menuSel].focus({ preventScroll:true }); } catch(e){}
  }

  function siblingMenu(d){
    if (!openMenu) return;
    var wraps = Array.prototype.slice.call(document.querySelectorAll(".tui-mwrap"));
    var i = wraps.indexOf(openMenu);
    if (i === -1) return;
    openMenuAt(wraps[(i + d + wraps.length) % wraps.length]);
  }

  function buildMenubar(){
    var bar = document.querySelector(".tui-menubar");
    if (!bar) return;
    bar.removeAttribute("aria-hidden");
    bar.classList.add("is-live");
    bar.setAttribute("role", "menubar");

    var clock = bar.querySelector(".clock");
    bar.innerHTML = "";

    MENUS.forEach(function(spec){
      var wrap = el("span", "tui-mwrap");
      wrap._spec = spec;

      var root = el("button", "tui-mroot", hotHtml(spec.label, spec.hot));
      root.type = "button";
      root.setAttribute("aria-haspopup", "true");
      root.setAttribute("aria-expanded", "false");
      root.addEventListener("click", function(e){ e.stopPropagation(); openMenuAt(wrap); });
      /* once one is open, sliding across the bar switches between them */
      root.addEventListener("mouseenter", function(){ if (openMenu && openMenu !== wrap) openMenuAt(wrap); });

      var drop = el("div", "tui-dropdown");
      drop.hidden = true;
      drop.setAttribute("role", "menu");

      wrap.appendChild(root);
      wrap.appendChild(drop);
      bar.appendChild(wrap);
    });

    if (clock) bar.appendChild(clock);

    document.addEventListener("click", function(e){
      if (openMenu && !openMenu.contains(e.target)) closeMenu();
    });

    document.addEventListener("keydown", function(e){
      if (e.altKey && !e.ctrlKey && !e.metaKey){
        var k = String(e.key || "").toLowerCase();
        for (var i = 0; i < MENUS.length; i++){
          if (MENUS[i].hot.toLowerCase() === k){
            e.preventDefault();
            openMenuAt(document.querySelectorAll(".tui-mwrap")[i]);
            moveMenuSel(1);
            return;
          }
        }
      }

      if (!modalStack.length){
        if (e.key === "F1"){ e.preventDefault(); MENUS[4].items()[0].act(); return; }
        if (e.key === "F2"){ e.preventDefault(); openSearch(); return; }
        if (e.key === "F10"){ e.preventDefault(); exitScreen(); return; }
      }

      if (!openMenu) return;

      switch (e.key){
        case "Escape":    e.preventDefault(); closeMenu(); break;
        case "ArrowDown": e.preventDefault(); moveMenuSel(1); break;
        case "ArrowUp":   e.preventDefault(); moveMenuSel(-1); break;
        case "ArrowRight":e.preventDefault(); siblingMenu(1); moveMenuSel(1); break;
        case "ArrowLeft": e.preventDefault(); siblingMenu(-1); moveMenuSel(1); break;
        case "Enter":
          e.preventDefault();
          var list = menuItems(openMenu);
          if (menuSel >= 0 && list[menuSel]) list[menuSel].click();
          break;
        default:
          /* the red letter picks the item straight off */
          if (e.key && e.key.length === 1){
            var want = e.key.toLowerCase();
            var all = menuItems(openMenu);
            for (var j = 0; j < all.length; j++){
              if (all[j].getAttribute("data-hot") === want){ e.preventDefault(); all[j].click(); return; }
            }
          }
      }
    });
  }

  /* ---------------------------------------------------------------
     GO
     --------------------------------------------------------------- */
  buildMenubar();
  initMenuNav();
  var boot = document.getElementById("boot");
  if (boot) startBoot(boot); else initTypewriter();
})();
