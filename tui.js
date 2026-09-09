/* ==================================================================
   TUI.JS — shared behaviour for every page
   ================================================================== */
(function(){
  "use strict";

  /* --- menu-bar clock --- */
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

  /* --- easter-egg buttons: <button data-alert="..."> --- */
  var alerts = document.querySelectorAll("[data-alert]");
  for (var i = 0; i < alerts.length; i++){
    alerts[i].addEventListener("click", function(){
      alert(this.getAttribute("data-alert"));
    });
  }

  /* --- boot sequence: only on pages that include #boot --- */
  var boot = document.getElementById("boot");
  if (!boot) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var seen = false;
  try { seen = sessionStorage.getItem("s95boot") === "1"; } catch(e){}

  function finish(){
    document.body.classList.add("booted");
    try { sessionStorage.setItem("s95boot","1"); } catch(e){}
  }

  if (reduce || seen){ finish(); return; }

  var lines = [
    "Secret95 BIOS v1.03  (C) 1995",
    "",
    "Memory Test : 640K OK",
    "Detecting IDE drives ... C: OK",
    "Loading SECRET95.EXE ...",
    ""
  ];
  var i2 = 0;
  boot.addEventListener("click", finish);
  document.addEventListener("keydown", function once(){
    document.removeEventListener("keydown", once); finish();
  });
  (function next(){
    if (document.body.classList.contains("booted")) return;
    if (i2 >= lines.length){ setTimeout(finish, 260); return; }
    boot.textContent += lines[i2++] + "\n";
    setTimeout(next, 190);
  })();
})();
