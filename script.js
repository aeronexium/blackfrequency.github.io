/**
 * script.js — OSINT Aggregator Frontend
 *
 * ⚙️  CONFIGURATION
 *     Change BACKEND_URL to your deployed Render URL before going live.
 *     While developing locally, keep it as localhost.
 */
const BACKEND_URL = "https://backend-w1hh.onrender.com/"; // ← change this!
// const BACKEND_URL = "http://localhost:8000";            // ← for local dev

// ─── State ────────────────────────────────────────────────────────────────────
let lastResults = null;   // stores the full API response for "Copy JSON"

// ─── DOM References ───────────────────────────────────────────────────────────
const searchInput   = document.getElementById("search-input");
const searchBtn     = document.getElementById("search-btn");
const btnText       = document.getElementById("btn-text");
const btnSpinner    = document.getElementById("btn-spinner");
const errorBanner   = document.getElementById("error-banner");
const errorText     = document.getElementById("error-text");
const resultsSection= document.getElementById("results-section");
const tabNav        = document.getElementById("tab-nav");
const tabPanels     = document.getElementById("tab-panels");
const summaryQueryVal = document.getElementById("summary-query-val");
const summaryType   = document.getElementById("summary-type");
const confBar       = document.getElementById("conf-bar");
const confPct       = document.getElementById("conf-pct");

// ─── Event Listeners ──────────────────────────────────────────────────────────
searchBtn.addEventListener("click", handleSearch);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSearch();
});

// ─── Fill example query (called by hint badges) ───────────────────────────────
function fillExample(val) {
  searchInput.value = val;
  searchInput.focus();
}

// ─── Main Search Handler ──────────────────────────────────────────────────────
async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    showError("Please enter a username, email, or domain.");
    return;
  }

  setLoading(true);
  hideError();
  hideResults();

  try {
    const url = `${BACKEND_URL}/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);

    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please wait a minute before trying again.");
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${response.status}`);
    }

    const data = await response.json();
    lastResults = data;
    renderResults(data);

  } catch (err) {
    showError(err.message || "Failed to connect to the OSINT backend. Is it running?");
  } finally {
    setLoading(false);
  }
}

// ─── Loading State ────────────────────────────────────────────────────────────
function setLoading(isLoading) {
  searchBtn.disabled = isLoading;
  btnText.textContent = isLoading ? "Searching…" : "Search";
  btnSpinner.classList.toggle("hidden", !isLoading);
}

// ─── Error Handling ───────────────────────────────────────────────────────────
function showError(msg) {
  errorText.textContent = "⚠ " + msg;
  errorBanner.classList.remove("hidden");
}

function hideError() {
  errorBanner.classList.add("hidden");
}

// ─── Results ──────────────────────────────────────────────────────────────────
function hideResults() {
  resultsSection.classList.add("hidden");
}

function renderResults(data) {
  const { query, query_type, results, confidence } = data;

  // Summary bar
  summaryQueryVal.textContent = query;
  summaryType.textContent = query_type;
  const pct = Math.round(confidence * 100);
  confBar.style.width = pct + "%";
  confPct.textContent  = pct + "%";

  // Confidence bar color
  if (pct >= 60) confBar.style.background = "#2ecc71";
  else if (pct >= 30) confBar.style.background = "#f39c12";
  else confBar.style.background = "#e03535";

  // Clear old tabs & panels
  tabNav.innerHTML    = "";
  tabPanels.innerHTML = "";

  // Build tabs based on what came back
  const tabs = buildTabs(query_type, results);

  tabs.forEach((tab, index) => {
    // Tab button
    const btn = document.createElement("button");
    btn.className   = "tab-btn" + (index === 0 ? " active" : "");
    btn.dataset.tab = tab.id;
    btn.innerHTML   = `
      <span class="tab-dot ${tab.status}"></span>
      ${tab.label}
    `;
    btn.addEventListener("click", () => switchTab(tab.id));
    tabNav.appendChild(btn);

    // Tab panel
    const panel = document.createElement("div");
    panel.className  = "tab-panel" + (index === 0 ? " active" : "");
    panel.id         = "panel-" + tab.id;
    panel.innerHTML  = tab.html;
    tabPanels.appendChild(panel);
  });

  resultsSection.classList.remove("hidden");
}

// ─── Tab Builder ─────────────────────────────────────────────────────────────
function buildTabs(queryType, results) {
  const tabs = [];

  if (queryType === "username" || results.github || results.reddit) {
    tabs.push({
      id:     "username",
      label:  "Username",
      status: getOverallStatus([results.github, results.reddit]),
      html:   buildUsernamePanel(results),
    });
  }

  if (queryType === "email" || results.gravatar) {
    tabs.push({
      id:     "email",
      label:  "Email",
      status: getOverallStatus([results.gravatar]),
      html:   buildEmailPanel(results),
    });
  }

  if (queryType === "domain" || results.dns || results.rdap) {
    tabs.push({
      id:     "domain",
      label:  "Domain / DNS",
      status: getOverallStatus([results.dns, results.rdap]),
      html:   buildDomainPanel(results),
    });
  }

  // Raw JSON tab — always visible
  tabs.push({
    id:     "raw",
    label:  "Raw JSON",
    status: "found",
    html:   `<pre style="font-family:var(--font-mono);font-size:12px;color:var(--text-2);white-space:pre-wrap;word-break:break-all;">${escHtml(JSON.stringify(results, null, 2))}</pre>`,
  });

  return tabs;
}

// ─── Panel Builders ───────────────────────────────────────────────────────────

function buildUsernamePanel(results) {
  let html = "";

  // GitHub card
  html += buildSourceCard({
    icon:   "🐙",
    title:  "GitHub",
    data:   results.github,
    fields: (d) => {
      if (!d.found) return '<p class="no-data">Not found on GitHub.</p>';
      let content = "";
      if (d.avatar_url) {
        content += `<div class="avatar-wrap">
          <img class="avatar-img" src="${escAttr(d.avatar_url)}" alt="GitHub avatar" loading="lazy">
          <div>
            <div style="font-weight:600;font-size:15px">${escHtml(d.name || d.url || "")}</div>
            <div style="color:var(--text-2);font-size:13px">${escHtml(d.bio || "")}</div>
          </div>
        </div>`;
      }
      content += renderFields([
        ["Profile URL", d.url       ? linkVal(d.url)    : null],
        ["Location",    d.location],
        ["Company",     d.company],
        ["Blog",        d.blog      ? linkVal(d.blog)   : null],
        ["Twitter",     d.twitter],
        ["Repos",       d.public_repos],
        ["Followers",   d.followers],
        ["Following",   d.following],
        ["Created",     formatDate(d.created_at)],
      ]);
      return content;
    },
  });

  // Reddit card
  html += buildSourceCard({
    icon:  "🤖",
    title: "Reddit",
    data:  results.reddit,
    fields: (d) => {
      if (!d.found) return '<p class="no-data">Not found on Reddit.</p>';
      return renderFields([
        ["Username",       d.name],
        ["Profile URL",    d.url         ? linkVal(d.url)  : null],
        ["Post karma",     d.karma_post],
        ["Comment karma",  d.karma_comment],
        ["Gold member",    d.is_gold     ? "Yes" : "No"],
        ["Account created", formatUnix(d.account_created)],
      ]);
    },
  });

  return html;
}

function buildEmailPanel(results) {
  let html = "";

  // Gravatar card
  html += buildSourceCard({
    icon:   "🖼",
    title:  "Gravatar",
    data:   results.gravatar,
    fields: (d) => {
      if (!d.found) return '<p class="no-data">No Gravatar account found for this email.</p>';
      let content = "";
      if (d.avatar_url) {
        content += `<div class="avatar-wrap">
          <img class="avatar-img" src="${escAttr(d.avatar_url)}" alt="Gravatar" loading="lazy">
          <div style="color:var(--text-2);font-size:13px">${escHtml(d.display_name || "")}</div>
        </div>`;
      }
      content += renderFields([
        ["Display name", d.display_name],
        ["Profile URL",  d.profile_url   ? linkVal(d.profile_url) : null],
        ["Location",     d.location],
        ["About",        d.about],
        ["Linked URLs",  d.urls          ? d.urls.map(u => linkVal(u)).join(", ") : null],
      ]);
      return content;
    },
  });

  // Email domain DNS card
  if (results.email_domain) {
    html += buildDnsCard(results.email_domain, "Email Domain DNS");
  }

  return html;
}

function buildDomainPanel(results) {
  let html = "";

  // RDAP / WHOIS card
  if (results.rdap) {
    html += buildSourceCard({
      icon:   "📋",
      title:  "RDAP / WHOIS",
      data:   results.rdap,
      fields: (d) => {
        if (!d.found) return '<p class="no-data">Domain not found in RDAP registry.</p>';
        const statusTags = (d.status || [])
          .map(s => `<span class="tag">${escHtml(s)}</span>`).join("");
        return renderFields([
          ["Registrar",   d.registrar],
          ["Registered",  formatDate(d.registered)],
          ["Updated",     formatDate(d.updated)],
          ["Expires",     formatDate(d.expires)],
          ["Status",      statusTags || null],
        ]);
      },
    });
  }

  // DNS card
  if (results.dns) {
    html += buildDnsCard(results.dns, "DNS Records");
  }

  return html;
}

// ─── Reusable Card Builder ────────────────────────────────────────────────────
function buildSourceCard({ icon, title, data, fields }) {
  if (!data) {
    return `<div class="result-card">
      <div class="card-header">
        <span class="card-icon">${icon}</span>${escHtml(title)}
        <span class="status-pill missing">No data</span>
      </div>
      <p class="no-data">No data returned.</p>
    </div>`;
  }

  if (data.error) {
    return `<div class="result-card">
      <div class="card-header">
        <span class="card-icon">${icon}</span>${escHtml(title)}
        <span class="status-pill error">Error</span>
      </div>
      <p style="color:var(--amber);font-size:13px">⚠ ${escHtml(data.error)}</p>
    </div>`;
  }

  const isFound   = data.found !== false;
  const pillClass = isFound ? "found" : "missing";
  const pillText  = isFound ? "Found" : "Not found";

  return `<div class="result-card">
    <div class="card-header">
      <span class="card-icon">${icon}</span>${escHtml(title)}
      <span class="status-pill ${pillClass}">${pillText}</span>
    </div>
    ${fields(data)}
  </div>`;
}

function buildDnsCard(dns, title) {
  if (!dns) return "";

  let content = "";
  if (!dns.exists) {
    content = '<p class="no-data">Domain does not resolve (no A/MX records found).</p>';
  } else {
    content = renderFields([
      ["IPv4 (A)",  dns.a    ? dnsTagList(dns.a)  : null],
      ["IPv6 (AAAA)", dns.aaaa ? dnsTagList(dns.aaaa) : null],
      ["MX records", dns.mx  ? dnsTagList(dns.mx) : null],
      ["NS records", dns.ns  ? dnsTagList(dns.ns) : null],
      ["SPF",        dns.spf   || null],
      ["DMARC",      dns.dmarc || null],
    ]);
  }

  const pill = dns.exists
    ? `<span class="status-pill found">Resolves</span>`
    : `<span class="status-pill missing">No records</span>`;

  return `<div class="result-card">
    <div class="card-header"><span class="card-icon">🔍</span>${escHtml(title)}${pill}</div>
    ${content}
  </div>`;
}

// ─── Field Grid Renderer ──────────────────────────────────────────────────────
function renderFields(pairs) {
  const rows = pairs
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([label, value]) =>
      `<span class="field-label">${escHtml(label)}</span><span class="field-value">${value}</span>`
    );
  if (!rows.length) return '<p class="no-data">No additional details.</p>';
  return `<div class="field-grid">${rows.join("")}</div>`;
}

function dnsTagList(arr) {
  if (!arr || !arr.length) return null;
  return `<ul class="dns-list">${arr.map(v => `<li>${escHtml(v)}</li>`).join("")}</ul>`;
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(id) {
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === id);
  });
  document.querySelectorAll(".tab-panel").forEach(p => {
    p.classList.toggle("active", p.id === "panel-" + id);
  });
}

// ─── Copy JSON ────────────────────────────────────────────────────────────────
function copyResults() {
  if (!lastResults) return;
  navigator.clipboard.writeText(JSON.stringify(lastResults, null, 2))
    .then(() => {
      const btn = document.querySelector(".copy-btn");
      const orig = btn.textContent;
      btn.textContent = "✔ Copied!";
      setTimeout(() => btn.textContent = orig, 1800);
    })
    .catch(() => alert("Copy failed — try Ctrl+A / Cmd+A on the Raw JSON tab."));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getOverallStatus(items) {
  const found = items.some(i => i && !i.error && i.found !== false);
  const hasError = items.some(i => i && i.error);
  if (found) return "found";
  if (hasError) return "error";
  return "missing";
}

function linkVal(url) {
  if (!url) return null;
  const safe = escAttr(url);
  return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${escHtml(url)}</a>`;
}

function formatDate(str) {
  if (!str) return null;
  try {
    return new Date(str).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  } catch { return str; }
}

function formatUnix(ts) {
  if (!ts) return null;
  try {
    return new Date(ts * 1000).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  } catch { return String(ts); }
}

function escHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(s) {
  return escHtml(s).replace(/'/g, "&#39;");
}
