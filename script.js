const API = "https://blackfrequency.gilbertteresa534.workers.dev/";

async function loadLogs() {
  const res = await fetch(API);
  const logs = await res.json();

  const div = document.getElementById("logs");
  div.innerHTML = "";

  logs.slice().reverse().forEach(log => {
    const el = document.createElement("div");
    el.className = "log";
    el.innerHTML = `
      <span class="time">${log.time}</span>
      <span class="freq">${log.freq}</span>
      <span class="msg">"${log.message}"</span>
    `;
    div.appendChild(el);
  });
}

setInterval(loadLogs, 10000);
loadLogs();
