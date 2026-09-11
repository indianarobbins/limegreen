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
    if (!host || REDUCE || twSeen()) return;
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
     Arrow keys move the highlight through the menu, Enter opens it.
     Focus is the selection, so the existing :focus-visible styling
     does the highlighting and Enter activates links and buttons
     natively — no key handling needed for activation.
     --------------------------------------------------------------- */
  var forceReveal = function(){ if (skipTyping) skipTyping(); };

  function initMenuNav(){
    var menu = document.querySelector(".tui-menu");
    if (!menu) return;

    var sel = -1;   /* our own selection state, independent of focus */

    function items(){
      return Array.prototype.slice.call(menu.querySelectorAll(".tui-btn"));
    }

    /* how many columns the grid is currently showing */
    function columns(){
      var t = getComputedStyle(menu).gridTemplateColumns;
      if (!t || t === "none") return 1;
      return t.trim().split(/\s+/).length;
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
    }

    /* clicking or hovering with a mouse clears the keyboard highlight */
    menu.addEventListener("mousedown", function(){
      var list = items();
      for (var i = 0; i < list.length; i++) list[i].classList.remove("is-selected");
      sel = -1;
    });

    document.addEventListener("keydown", function(e){
      var k = e.key;
      var isArrow = (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight");
      if (!isArrow && k !== "Home" && k !== "End" && k !== "Enter") return;
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

      /* an arrow while the page is still printing reveals it first,
         so the very first press also lands on an item */
      forceReveal();
      list = items();
      if (!list.length) return;

      var n = list.length;
      var cols = columns();
      var j;

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
     GO
     --------------------------------------------------------------- */
  initMenuNav();
  var boot = document.getElementById("boot");
  if (boot) startBoot(boot); else initTypewriter();
})();
