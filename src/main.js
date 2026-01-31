import "svg-world-map/dist/svg-world-map.css";
import "./style.css";
import { svgWorldMap } from "svg-world-map";

const COLORS = {
  lived: "#2b7cff",
  visited: "#1db954",
  transited: "#ff9f2f",
  none: "#2a2e39",
};

const ORDER = ["none", "transited", "visited", "lived"]; // クリックで巡回

// 初期状態：Ryotaは日本（東京）に住んでる
const DEFAULT = { JP: "lived" };

const STORAGE_KEY = "ryota_travel_map_v1";

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed };
  } catch {
    return { ...DEFAULT };
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function nextStatus(current) {
  const idx = ORDER.indexOf(current ?? "none");
  return ORDER[(idx + 1) % ORDER.length];
}

const elMap = document.getElementById("map");
const elList = document.getElementById("listBody");
const elFilter = document.getElementById("filter");
const elStatusFilter = document.getElementById("statusFilter");

const elLived = document.getElementById("count-lived");
const elVisited = document.getElementById("count-visited");
const elTransited = document.getElementById("count-transited");
const elTotal = document.getElementById("count-total");
const elWorld = document.getElementById("count-world");
const elPercent = document.getElementById("percent");

const btnExport = document.getElementById("btn-export");
const btnReset = document.getElementById("btn-reset");
const importFile = document.getElementById("importFile");

let data = loadData();

function buildColorMap(statusByCountry) {
  const out = {};
  for (const [cc, status] of Object.entries(statusByCountry)) {
    out[cc] = COLORS[status] ?? COLORS.none;
  }
  return out;
}

function normalize(text) {
  return (text ?? "").toLowerCase().trim();
}

function getStats() {
  let lived = 0, visited = 0, transited = 0;
  for (const s of Object.values(data)) {
    if (s === "lived") lived++;
    if (s === "visited") visited++;
    if (s === "transited") transited++;
  }
  const total = lived + visited + transited;
  return { lived, visited, transited, total };
}

function renderStats() {
  const { lived, visited, transited, total } = getStats();
  elLived.textContent = lived;
  elVisited.textContent = visited;
  elTransited.textContent = transited;
  elTotal.textContent = total;

  const denom = Number(elWorld.textContent) || 195;
  const pct = denom ? (total / denom) * 100 : 0;
  elPercent.textContent = pct.toFixed(1);
}

function renderMap() {
  elMap.innerHTML = "";

  svgWorldMap({
    targetElementID: "map",
    color: COLORS.none,
    countries: buildColorMap(data),
    showCountryNames: true,
    onClick: ({ countryCode }) => {
      const cur = data[countryCode] ?? "none";
      const nxt = nextStatus(cur);

      if (nxt === "none") delete data[countryCode];
      else data[countryCode] = nxt;

      saveData(data);
      renderAll();
    },
  });
}

function renderList() {
  elList.innerHTML = "";

  // svg-world-mapが作るDOMから国情報を拾う
  const countryEls = [...document.querySelectorAll("#map svg [data-country-code]")];

  const keyword = normalize(elFilter.value);
  const statusFilter = elStatusFilter.value;

  const rows = countryEls
    .map((node) => {
      const code = node.getAttribute("data-country-code");
      const name = node.getAttribute("data-country-name") || code;
      const status = data[code] ?? "none";
      return { code, name, status };
    })
    .filter((x) => (keyword ? normalize(x.name).includes(keyword) : true))
    .filter((x) => (statusFilter === "all" ? true : x.status === statusFilter))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const r of rows) {
    const div = document.createElement("div");
    div.className = "row";
    div.innerHTML = `
      <div>
        <div style="font-weight:700">${r.name}</div>
        <div style="color:#9aa4b2;font-size:12px">${r.code}</div>
      </div>
      <div class="badge ${r.status}">${r.status}</div>
    `;

    div.addEventListener("click", () => {
      const cur = data[r.code] ?? "none";
      const nxt = nextStatus(cur);
      if (nxt === "none") delete data[r.code];
      else data[r.code] = nxt;
      saveData(data);
      renderAll();
    });

    elList.appendChild(div);
  }
}

function renderAll() {
  renderMap();
  // map DOM生成後に list/stats
  setTimeout(() => {
    renderList();
    renderStats();
  }, 0);
}

elFilter.addEventListener("input", () => renderList());
elStatusFilter.addEventListener("change", () => renderList());

btnExport.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "countries.json";
  a.click();

  URL.revokeObjectURL(url);
});

importFile.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const text = await file.text();
  try {
    const imported = JSON.parse(text);
    data = { ...DEFAULT, ...imported };
    saveData(data);
    renderAll();
  } catch {
    alert("JSONの形式が違う！");
  } finally {
    importFile.value = "";
  }
});

btnReset.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  data = loadData();
  renderAll();
});

renderAll();
