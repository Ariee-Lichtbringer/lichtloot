(function () {
  const guild = new URLSearchParams(window.location.search).get("guild");
  if (!guild || ["lichtloot", "lichtbringer"].includes(guild.trim().toLowerCase())) return;

  const root = document.documentElement;
  root.classList.add("guild-page-booting");

  const style = document.createElement("style");
  style.textContent = [
    "html.guild-page-booting{background:#020617!important}",
    "html.guild-page-booting body{visibility:hidden!important}",
    "html.guild-page-booting::after{content:'Gilde wird geöffnet …';position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#020617;color:#f8fafc;font:900 18px Arial,sans-serif;letter-spacing:.04em;visibility:visible}"
  ].join("");
  document.head.appendChild(style);

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    root.classList.remove("guild-page-booting");
  }

  window.addEventListener("load", function () {
    window.setTimeout(finish, 900);
  }, { once: true });
  window.setTimeout(finish, 6000);
})();
