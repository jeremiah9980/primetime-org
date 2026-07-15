/* Primetime CMS content renderer.
   Fetches cms/content/primetime-site.json and fills in every [data-pt-*] mount
   point found on the page. Pages keep their static placeholder markup as a
   fallback — if the fetch fails (e.g. offline, opened from disk without a
   server) nothing breaks, the placeholder copy just stays visible.

   For pages nested in a subfolder, set the content path first:
     <script>window.PRIMETIME_CONTENT_URL = "../cms/content/primetime-site.json";</script>
*/
(function () {
  var url = window.PRIMETIME_CONTENT_URL || "cms/content/primetime-site.json";

  function installPrimaryLogo() {
    document.querySelectorAll("img[src*='primetime-logo.png']").forEach(function (img) {
      img.src = img.getAttribute("src").replace("primetime-logo.png", "primetime-logo.svg");
      img.style.display = "block";
      var fallback = img.nextElementSibling;
      if (fallback && fallback.classList.contains("pt-logo-fallback")) fallback.style.display = "none";
      var showcase = img.closest(".logo-showcase");
      if (showcase) showcase.classList.remove("logo-missing");
    });
    document.querySelectorAll("link[rel~='icon'][href*='primetime-logo.png']").forEach(function (link) {
      link.href = link.getAttribute("href").replace("primetime-logo.png", "primetime-logo.svg");
      link.type = "image/svg+xml";
    });
  }

  installPrimaryLogo();

  function text(el, value) {
    if (el && value !== undefined && value !== null && value !== "") el.textContent = value;
  }
  function href(el, value) {
    if (el && value) el.setAttribute("href", value);
  }
  function teamById(data, id) {
    return (data.teams || []).find(function (t) { return t.id === id; });
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderOrg(data) {
    document.querySelectorAll("[data-pt-org-name]").forEach(function (el) { text(el, data.org.name); });
    document.querySelectorAll("[data-pt-org-nickname]").forEach(function (el) { text(el, data.org.nickname); });
    document.querySelectorAll("[data-pt-org-tagline]").forEach(function (el) { text(el, data.org.tagline); });
    document.querySelectorAll("[data-pt-org-mission]").forEach(function (el) { text(el, data.org.missionStatement); });
    document.querySelectorAll("[data-pt-org-location]").forEach(function (el) { text(el, data.org.location); });
    document.querySelectorAll("[data-pt-org-email]").forEach(function (el) {
      text(el, data.org.contact && data.org.contact.generalEmail);
      href(el, data.org.contact && ("mailto:" + data.org.contact.generalEmail));
    });
    document.querySelectorAll("[data-pt-board-email]").forEach(function (el) {
      text(el, data.org.contact && data.org.contact.boardEmail);
      href(el, data.org.contact && ("mailto:" + data.org.contact.boardEmail));
    });
    document.querySelectorAll("[data-pt-org-phone]").forEach(function (el) { text(el, data.org.contact && data.org.contact.phone); });
    document.querySelectorAll("[data-pt-instagram]").forEach(function (el) { href(el, data.org.social && data.org.social.instagram); });
    document.querySelectorAll("[data-pt-facebook]").forEach(function (el) { href(el, data.org.social && data.org.social.facebook); });
  }

  function renderBoard(data) {
    document.querySelectorAll("[data-pt-board-list]").forEach(function (el) {
      if (!data.board || !data.board.length) return;
      el.innerHTML = data.board.map(function (m) {
        return '<article class="elite-card"><h3>' + escapeHtml(m.role) + '</h3><p>' + escapeHtml(m.name || "TBD") + "</p></article>";
      }).join("");
    });
  }

  function renderCoaching(data) {
    document.querySelectorAll("[data-pt-coaching-list]").forEach(function (el) {
      if (!data.teams) return;
      el.innerHTML = data.teams.map(function (t) {
        var coach = t.headCoach || {};
        return '<article class="elite-card"><h3>' + escapeHtml(t.name) + ' Head Coach</h3><p>' + escapeHtml(coach.name || "Name — Placeholder") + "</p>" +
          (coach.bio ? "<p>" + escapeHtml(coach.bio) + "</p>" : "<p>Leads " + escapeHtml(t.name) + " practices, games, and player development.</p>") +
          '<a href="teams/' + t.id + '.html">View team &rarr;</a></article>';
      }).join("");
    });
  }

  function renderTeamInfo(data) {
    document.querySelectorAll("[data-pt-team-info]").forEach(function (el) {
      var t = teamById(data, el.getAttribute("data-pt-team-info"));
      if (!t) return;
      var h = el.querySelector("[data-pt-field='tagline']");
      var p = el.querySelector("[data-pt-field='description']");
      text(h, t.tagline);
      text(p, t.description);
    });
    document.querySelectorAll("[data-pt-team-coach]").forEach(function (el) {
      var t = teamById(data, el.getAttribute("data-pt-team-coach"));
      if (t && t.headCoach) text(el, t.headCoach.name);
    });
  }

  function renderRoster(data) {
    document.querySelectorAll("[data-pt-roster]").forEach(function (el) {
      var t = teamById(data, el.getAttribute("data-pt-roster"));
      var limit = el.getAttribute("data-pt-roster-limit");
      if (!t) return;
      var roster = t.roster || [];
      if (limit) roster = roster.slice(0, parseInt(limit, 10));
      if (!roster.length) {
        el.innerHTML = '<tr><td colspan="4" style="padding:1rem;color:var(--muted);">Roster coming soon &mdash; add players via the CMS at <code>cms/admin/</code>.</td></tr>';
        return;
      }
      el.innerHTML = roster.map(function (p) {
        return '<tr style="border-bottom:1px solid var(--line);">' +
          '<td style="padding:.75rem;font-weight:800;color:var(--gold);">#' + escapeHtml(p.number || "--") + "</td>" +
          '<td style="padding:.75rem;">' + escapeHtml(p.name || "Player") + "</td>" +
          '<td style="padding:.75rem;color:var(--muted);">' + escapeHtml(p.position || "TBD") + "</td>" +
          '<td style="padding:.75rem;color:var(--muted);">' + escapeHtml(p.batsThrows || "&mdash;") + "</td></tr>";
      }).join("");
    });
    document.querySelectorAll("[data-pt-roster-preview]").forEach(function (el) {
      var t = teamById(data, el.getAttribute("data-pt-roster-preview"));
      if (!t || !t.roster || !t.roster.length) return;
      el.innerHTML = t.roster.slice(0, 5).map(function (p) {
        return '<div class="roster-row"><b>#' + escapeHtml(p.number || "--") + "</b><small>" + escapeHtml(p.name || "Player") + "</small><span>" + escapeHtml(p.position || "TBD") + "</span></div>";
      }).join("");
    });
  }

  function renderGameChangerAndNcs(data) {
    document.querySelectorAll("[data-pt-gamechanger-schedule]").forEach(function (el) {
      var t = teamById(data, el.getAttribute("data-pt-gamechanger-schedule"));
      var url = t && t.gamechanger && t.gamechanger.scheduleUrl;
      if (url && url.indexOf("ENTER") === -1) {
        el.innerHTML = '<a class="btn ghost" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Open GameChanger Schedule</a>';
      }
    });
    document.querySelectorAll("[data-pt-gamechanger-stats]").forEach(function (el) {
      var t = teamById(data, el.getAttribute("data-pt-gamechanger-stats"));
      var url = t && t.gamechanger && t.gamechanger.statsUrl;
      if (url && url.indexOf("ENTER") === -1) {
        el.innerHTML = '<a class="btn ghost" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Open GameChanger Stats</a>';
      }
    });
    document.querySelectorAll("[data-pt-ncs]").forEach(function (el) {
      var t = teamById(data, el.getAttribute("data-pt-ncs"));
      var url = t && t.ncs && t.ncs.teamUrl;
      if (url && url.indexOf("ENTER") === -1) {
        el.innerHTML = '<a class="btn ghost" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Open NCS Team Page</a>';
      }
    });
  }

  function renderFundraising(data) {
    document.querySelectorAll("[data-pt-fundraising-intro]").forEach(function (el) { text(el, data.fundraising && data.fundraising.intro); });
    document.querySelectorAll("[data-pt-sponsors]").forEach(function (el) {
      var sponsors = (data.fundraising && data.fundraising.sponsors) || [];
      if (!sponsors.length) return;
      el.innerHTML = sponsors.map(function (s) {
        var inner = s.logo ? '<img src="' + escapeHtml(s.logo) + '" alt="' + escapeHtml(s.name) + ' logo" style="max-width:80%;max-height:80%;">' : escapeHtml(s.name);
        return '<div class="media-tile" style="display:grid;place-items:center;padding:.5rem;">' + (s.url ? '<a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener">' + inner + "</a>" : inner) + "</div>";
      }).join("");
    });
  }

  function renderDocs(data) {
    document.querySelectorAll("[data-pt-docs-list]").forEach(function (el) {
      if (!data.docs || !data.docs.length) return;
      el.innerHTML = data.docs.map(function (d) {
        return '<div class="doc-item"><span class="doc-icon">&#128196;</span><div class="doc-info"><div class="doc-name">' + escapeHtml(d.name) + '</div><div class="doc-desc">' + escapeHtml(d.description || "") + "</div></div>" +
          (d.url ? '<a class="btn ghost" href="' + escapeHtml(d.url) + '" target="_blank" rel="noopener">Download</a>' : '<span class="status-pill">Coming soon</span>') + "</div>";
      }).join("");
    });
  }

  function renderKeyedText(data, sectionKey, attr) {
    document.querySelectorAll("[" + attr + "]").forEach(function (el) {
      var key = el.getAttribute(attr);
      var section = data[sectionKey];
      if (section && section[key]) text(el, section[key]);
    });
  }

  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      renderOrg(data);
      renderBoard(data);
      renderCoaching(data);
      renderTeamInfo(data);
      renderRoster(data);
      renderGameChangerAndNcs(data);
      renderFundraising(data);
      renderDocs(data);
      renderKeyedText(data, "policies", "data-pt-policy");
      renderKeyedText(data, "bylaws", "data-pt-bylaws");
      renderKeyedText(data, "finances", "data-pt-finances");
      document.dispatchEvent(new CustomEvent("primetime-content-ready", { detail: data }));
    })
    .catch(function (err) {
      console.warn("Primetime CMS content not loaded, showing static fallback content.", err);
    });
})();
