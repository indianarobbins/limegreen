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
  var CPS = 420;              // characters per second
  var MAX_FULL_CHARS = 2000;  // beyond this, "full" degrades to "intro"
  var SKIP_SELECTOR = ".tui-titlebar,.tui-closebox,.rule,.tui-menu,.tui-actions,.sysrow,.tui-menubar,.tui-statusbar";

  function initTypewriter(){
    var host = document.querySelector("[data-typewriter]");
    if (!host || REDUCE) return;

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

    var idx = 0, chars = 0, start = null, done = false;

    function finish(){
      if (done) return;
      done = true;
      for (var f = 0; f < cut; f++) items[f].node.nodeValue = items[f].text;
      if (caret.parentNode) caret.parentNode.removeChild(caret);
      for (var g = 0; g < hidden.length; g++) hidden[g].classList.remove("tw-hide");
      for (var q = 0; q < deferred.length; q++) deferred[q].classList.remove("tw-hide");
      host.removeAttribute("aria-busy");
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

    function frame(ts){
      if (done) return;
      if (start === null) start = ts;
      var want = Math.floor(((ts - start) / 1000) * CPS);

      while (chars < want && idx < cut){
        var it = items[idx];
        var have = it.node.nodeValue.length;
        if (have >= it.text.length){ idx++; continue; }
        var take = Math.min(it.text.length - have, want - chars);
        it.node.nodeValue = it.text.slice(0, have + take);
        chars += take;
        if (it.node.parentNode && caret.parentNode !== it.node.parentNode){
          it.node.parentNode.insertBefore(caret, it.node.nextSibling);
        }
      }

      if (idx >= cut){ finish(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------
     BOOT SEQUENCE — only on pages that include #boot
     --------------------------------------------------------------- */
  var boot = document.getElementById("boot");
  if (!boot){ initTypewriter(); return; }

  var seen = false;
  try { seen = sessionStorage.getItem("s95boot") === "1"; } catch(e){}

  function bootDone(){
    if (document.body.classList.contains("booted")) return;
    document.body.classList.add("booted");
    try { sessionStorage.setItem("s95boot","1"); } catch(e){}
    initTypewriter();
  }

  if (REDUCE || seen){ bootDone(); return; }

  var lines = [
    "Secret95 BIOS v1.03  (C) 1995",
    "",
    "Memory Test : 640K OK",
    "Detecting IDE drives ... C: OK",
    "Loading SECRET95.EXE ...",
    ""
  ];
  var li = 0;
  boot.addEventListener("click", bootDone);
  document.addEventListener("keydown", function once(){
    document.removeEventListener("keydown", once); bootDone();
  });
  (function next(){
    if (document.body.classList.contains("booted")) return;
    if (li >= lines.length){ setTimeout(bootDone, 260); return; }
    boot.textContent += lines[li++] + "\n";
    setTimeout(next, 190);
  })();
})();
