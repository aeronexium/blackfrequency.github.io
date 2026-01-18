const API = "https://blackfrequency.gilbertteresa534.workers.dev/";

async function loadLogs() {
  const div = document.getElementById("logs");

  try {
    const res = await fetch(API);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const logs = await res.json();
    div.innerHTML = "";

    if (!Array.isArray(logs) || logs.length === 0) {
      div.innerHTML = "<p class='loading'>No transmissions yet</p>";
      return;
    }

    logs.slice().reverse().forEach(log => {
      const el = document.createElement("div");
      el.className = "log";
      el.innerHTML = `
        <span class="time">${log.time ?? "??:?? UTC"}</span>
        <span class="freq">${log.freq ?? "???? kHz"}</span>
        <span class="msg">"${log.message ?? "UNKNOWN"}"</span>
      `;
      div.appendChild(el);
    });

  } catch (err) {
    console.error("Backend error:", err);
    div.innerHTML = "<p class='error'>Backend offline or invalid response</p>";
  }
}

loadLogs();
setInterval(loadLogs, 10000);
