(function () {
  "use strict";
  let guildServer = "";

  function refresh() {
    if (!document.body) return;
    let suggestions = document.getElementById("guildlootServerSuggestions");
    if (!suggestions) {
      suggestions = document.createElement("datalist");
      suggestions.id = "guildlootServerSuggestions";
      document.body.appendChild(suggestions);
    }
    suggestions.replaceChildren();
    const seen = new Set();
    [guildServer, "Everlook", "Lakeshire"].filter(Boolean).forEach(server => {
      const key = server.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const option = document.createElement("option");
      option.value = server;
      suggestions.appendChild(option);
    });
    document.querySelectorAll("[data-guildloot-server]").forEach(field => {
      // Keep a realm entered by the player, even if guild metadata arrives late.
      if (field.dataset.serverEdited === "true") return;
      if (!field.value || field.value === field.dataset.guildServerDefault) {
        field.value = guildServer;
        field.dataset.guildServerDefault = guildServer;
      }
    });
  }

  window.GuildLootServers = {
    refresh,
    setGuild(guild) {
      guildServer = String(guild?.server || "").trim();
      refresh();
    }
  };
  document.addEventListener("input", event => {
    if (event.target.matches("[data-guildloot-server]")) {
      event.target.dataset.serverEdited = "true";
    }
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();
