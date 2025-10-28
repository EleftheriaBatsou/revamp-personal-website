/**
 * Game-like portfolio interactions and dynamic content.
 * Pulls data from GitHub, Dev.to, Hashnode RSS, and README for recent videos and details.
 */

const GH_USERNAME = "EleftheriaBatsou";
const GH_PROFILE_API = `https://api.github.com/users/${GH_USERNAME}`;
const GH_README_RAW = `https://raw.githubusercontent.com/${GH_USERNAME}/${GH_USERNAME}/main/README.md`;
const DEVTO_API = `https://dev.to/api/articles?username=${GH_USERNAME.toLowerCase()}&per_page=6`;
const HASHNODE_RSS = "https://eleftheriabatsou.hashnode.dev/rss.xml";

// Basic HUD behavior: timer countdown and coins increment on block click
let timeLeft = 400;
let coinCount = 0;
const timerEl = document.getElementById("timer");
const coinEl = document.getElementById("coin-count");
const yearEl = document.getElementById("year");
yearEl.textContent = new Date().getFullYear();

// Simple countdown
setInterval(() => {
  if (timeLeft > 0) {
    timeLeft -= 1;
    timerEl.textContent = String(timeLeft).padStart(3, "0");
  }
}, 1000);

// Panel toggling via blocks
const blocks = document.querySelectorAll(".block");
const panels = {
  about: document.getElementById("panel-about"),
  videos: document.getElementById("panel-videos"),
  articles: document.getElementById("panel-articles"),
  speaking: document.getElementById("panel-speaking"),
  links: document.getElementById("panel-links"),
};

blocks.forEach((b) => {
  b.addEventListener("click", () => {
    const target = b.dataset.panel;
    Object.values(panels).forEach((p) => p.classList.remove("active"));
    panels[target]?.classList.add("active");
    // coin sfx (visual only)
    coinCount += 1;
    coinEl.textContent = String(coinCount).padStart(2, "0");
  });
});

// Peach follows mouse horizontally slightly
const peach = document.getElementById("peach");
document.addEventListener("mousemove", (e) => {
  const { innerWidth } = window;
  const ratio = e.clientX / innerWidth;
  const offset = (ratio - 0.5) * 180; // -90 to +90
  peach.style.transform = `translateX(calc(-50% + ${offset}px))`;
});

// Fetch GitHub profile info (avatar, name, bio only)
async function fetchGitHubProfile() {
  const bioEl = document.getElementById("bio");
  const nameEl = document.getElementById("name");
  const avatarEl = document.getElementById("avatar");

  try {
    const res = await fetch(GH_PROFILE_API);
    if (!res.ok) throw new Error("GitHub API error");
    const data = await res.json();
    avatarEl.src = data.avatar_url;
    nameEl.textContent = data.name || data.login;
    bioEl.textContent = data.bio || "Developer Advocate and content creator.";
  } catch (err) {
    bioEl.textContent = "Unable to load GitHub profile right now.";
    console.error(err);
  }
}

// Parse intro paragraph from README "About" section
function parseIntroFromReadme(text) {
  const aboutIdx = text.indexOf("#### About");
  if (aboutIdx === -1) return null;
  const slice = text.slice(aboutIdx);
  const lines = slice.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase().startsWith("#### about")) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;
  const paras = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("####")) break; // next section
    if (line.trim() === "") {
      if (paras.length) break;
      else continue;
    }
    paras.push(line);
  }
  const md = paras.join(" ");
  return md.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

// Parse highlights from "🌱 That's me" bullet list
function parseHighlightsFromReadme(text) {
  const idx = text.indexOf("#### 🌱 That's me");
  if (idx === -1) return [];
  const slice = text.slice(idx);
  const lines = slice.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase().includes("that's me")) {
      start = i + 1;
      break;
    }
  }
  const items = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("####")) break; // end of section
    if (/^-\s+/.test(line)) {
      const html = line
        .replace(/^-\s+/, "")
        .replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      items.push(html);
    }
  }
  return items;
}

async function renderAboutDetails() {
  const introEl = document.getElementById("about-intro");
  const highlightsEl = document.getElementById("about-highlights");
  try {
    const res = await fetch(GH_README_RAW);
    if (!res.ok) throw new Error("README load error");
    const text = await res.text();
    const intro = parseIntroFromReadme(text);
    const highlights = parseHighlightsFromReadme(text);
    if (intro) introEl.innerHTML = intro;
    else introEl.textContent = "Developer Advocate focused on UX, research and content.";
    highlightsEl.innerHTML = "";
    if (highlights.length) {
      highlights.slice(0, 6).forEach((h) => {
        const li = document.createElement("li");
        li.innerHTML = h;
        highlightsEl.appendChild(li);
      });
    } else {
      highlightsEl.innerHTML = "<li>Creating content, building communities, organizing events and conferences.</li>";
    }
  } catch (err) {
    console.error(err);
    introEl.textContent = "Unable to load README details right now.";
  }
}

// Parse recent videos from README using multiple patterns
function parseVideosFromReadme(readmeText) {
  // Generic parser: find any markdown links pointing to YouTube and use the link text as title
  const items = [];

  // Patterns covering both youtube.com and youtu.be, with various markdown formats
  const patterns = [
    /\[(.*?)\]\((https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[^)\s]+)\)/g, // [Title](https://www.youtube.com/watch?v=...)
    /\[(.*?)\]\((https?:\/\/youtu\.be\/[A-Za-z0-9_-]+)\)/g,                 // [Title](https://youtu.be/ID)
    /\[!\[.*?\]\]\((https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[^)\s]+)\)[^\n]*\n\[(.*?)\]\(\1\)/g // image then [Title](same link)
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(readmeText)) && items.length < 12) {
      const title = (m[1] || "").trim();
      const url = m[2];
      if (title && url) items.push({ title, url });
    }
  }

  // De-duplicate by URL
  const seen = new Set();
  const unique = [];
  for (const it of items) {
    if (!seen.has(it.url)) {
      seen.add(it.url);
      unique.push(it);
    }
  }

  // Infer date near the URL in the README
  function findDateNear(url) {
    const idx = readmeText.indexOf(url);
    if (idx === -1) return "";
    const context = readmeText.slice(Math.max(0, idx - 160), Math.min(readmeText.length, idx + 160));
    const patterns = [
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i, // Oct 23, 2025
      /\b\d{4}-\d{2}-\d{2}\b/, // 2025-10-23
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/ // 10/23/2025
    ];
    for (const rp of patterns) {
      const m = context.match(rp);
      if (m) return m[0];
    }
    return "";
  }

  return unique.slice(0, 4).map((i) => {
    let vid = "";
    try {
      const u = new URL(i.url);
      vid = u.searchParams.get("v") || (u.pathname.split("/").pop() || "");
    } catch (_) {}
    return {
      title: i.title,
      url: i.url,
      thumb: vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : "",
      date: findDateNear(i.url)
    };
  });
}

// Optional: YouTube RSS (no API key) using channel ID
const YT_CHANNEL_ID = "UCC-WwYv3DEW7Nkm_IP6VeQQ"; // Eleftheria's channel ID

async function fetchYouTubeRSS(){
  if(!YT_CHANNEL_ID) return null;

  const sources = [
    // Jina proxy (CORS-friendly)
    (id)=> `https://r.jina.ai/http://www.youtube.com/feeds/videos.xml?channel_id=${id}`,
    // Isomorphic-git proxy
    (id)=> `https://cors.isomorphic-git.org/https://www.youtube.com/feeds/videos.xml?channel_id=${id}`,
    // AllOrigins proxy
    (id)=> `https://api.allorigins.win/raw?url=${encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id=' + id)}`
  ];

  for (const makeUrl of sources) {
    const url = makeUrl(YT_CHANNEL_ID);
    try{
      const res = await fetch(url);
      if(!res.ok) throw new Error(`YouTube RSS error via ${url}`);
      const text = await res.text();

      // Parse RSS/Atom XML
      const xml = new DOMParser().parseFromString(text, "application/xml");
      const entries = Array.from(xml.getElementsByTagName("entry")).slice(0,4);
      if (!entries.length) continue;

      const videos = entries.map(e=>{
        const title = e.getElementsByTagName("title")[0]?.textContent || "YouTube Video";
        // Prefer link rel="alternate"
        let linkUrl = "";
        const links = Array.from(e.getElementsByTagName("link"));
        const altLink = links.find(l => (l.getAttribute("rel") || "") === "alternate");
        linkUrl = altLink ? altLink.getAttribute("href") : (links[0]?.getAttribute("href") || "");

        const published = e.getElementsByTagName("published")[0]?.textContent || "";
        const date = published ? new Date(published).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}) : "";

        // Derive video ID for thumbnail
        let vId = "";
        try {
          const u = new URL(linkUrl);
          vId = u.searchParams.get("v") || (u.pathname.split("/").pop() || "");
        } catch(_) {}
        const thumb = vId ? `https://img.youtube.com/vi/${vId}/hqdefault.jpg` : "";

        return {title, url: linkUrl, thumb, date};
      });

      if (videos.length) return videos;
    }catch(err){
      console.warn('RSS fetch failed:', err.message);
      // try next source
    }
  }

  return null;
}

async function fetchVideos() {
  const grid = document.getElementById("videos-grid");
  grid.innerHTML = "";

  try {
    // Prefer RSS for title and date
    const rssVideos = await fetchYouTubeRSS();
    if(rssVideos && rssVideos.length){
      rssVideos.slice(0,4).forEach((v, i)=>{
        const card = document.createElement("div");
        card.className = "video-card";

        const thumbLink = document.createElement("a");
        thumbLink.href = v.url; thumbLink.target = "_blank"; thumbLink.rel = "noopener";
        thumbLink.innerHTML = `<img src="${v.thumb}" alt="${v.title}">`;

        const info = document.createElement("div");
        info.className = "video-info";
        info.innerHTML = `
          <a class="video-title" href="${v.url}" target="_blank" rel="noopener">${v.title}</a>
          <div class="video-meta">${v.date || ""}</div>
        `;

        card.appendChild(thumbLink);
        card.appendChild(info);
        grid.appendChild(card);
        setTimeout(()=>card.classList.add("visible"), 60*i);
      });
      return;
    }

    // Fallback: parse README
    const res = await fetch(GH_README_RAW);
    if (!res.ok) throw new Error("Failed to load README");
    const text = await res.text();
    const videos = parseVideosFromReadme(text);

    if (videos.length === 0) {
      grid.innerHTML = `<p>Could not find recent videos in the README. Visit <a href="https://www.youtube.com/c/eleftheriabatsou" target="_blank">YouTube</a>.</p>`;
      return;
    }

    videos.slice(0,4).forEach((v, i) => {
      const card = document.createElement("div");
      card.className = "video-card";

      const thumbLink = document.createElement("a");
      thumbLink.href = v.url; thumbLink.target = "_blank"; thumbLink.rel = "noopener";
      thumbLink.innerHTML = `<img src="${v.thumb}" alt="${v.title}">`;

      const info = document.createElement("div");
      info.className = "video-info";
      info.innerHTML = `
        <a class="video-title" href="${v.url}" target="_blank" rel="noopener">${v.title}</a>
        <div class="video-meta">${v.date || ""}</div>
      `;

      card.appendChild(thumbLink);
      card.appendChild(info);
      grid.appendChild(card);
      setTimeout(() => card.classList.add("visible"), 60 * i);
    });
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p>Unable to load videos from GitHub README.</p>`;
  }
}

// Fetch articles from Dev.to and Hashnode RSS
async function fetchDevToArticles() {
  try {
    const res = await fetch(DEVTO_API);
    if (!res.ok) throw new Error("Dev.to API error");
    const articles = await res.json();
    return (articles || []).map((a) => ({
      title: a.title,
      url: a.url,
      date: a.readable_publish_date,
      source: "Dev.to",
    }));
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function fetchHashnodeRSS() {
  try {
    const res = await fetch(HASHNODE_RSS);
    if (!res.ok) throw new Error("Hashnode RSS error");
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "application/xml");
    const items = Array.from(xml.querySelectorAll("item")).slice(0, 6);
    return items.map((it) => ({
      title: it.querySelector("title")?.textContent || "Hashnode Article",
      url: it.querySelector("link")?.textContent || "#",
      date: it.querySelector("pubDate")?.textContent || "",
      source: "Hashnode",
    }));
  } catch (err) {
    // Network or CORS issue; skip Hashnode and continue silently
    console.warn("Hashnode RSS unavailable:", err?.message || err);
    return [];
  }
}

async function renderArticles() {
  const container = document.getElementById("articles-list");
  container.innerHTML = "";

  const [devto, hashnode] = await Promise.all([fetchDevToArticles(), fetchHashnodeRSS()]);

  const all = [...devto, ...hashnode]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  if (all.length === 0) {
    container.innerHTML = `<p>Unable to load latest articles right now.</p>`;
    return;
  }

  all.forEach((a, i) => {
    const item = document.createElement("div");
    item.className = "article-item";
    item.innerHTML = `
      <div class="source">${a.source}</div>
      <div class="info">
        <a href="${a.url}" target="_blank" rel="noopener">${a.title}</a>
        <div class="date">${a.date}</div>
      </div>
    `;
    container.appendChild(item);
    setTimeout(() => item.classList.add("visible"), 70 * i);
  });
}

// Speaking highlights pulled from README where available
function parseSpeakingFromReadme(readmeText) {
  const start = readmeText.indexOf("Sometimes I speak at conferences");
  if (start === -1) return [];
  const slice = readmeText.slice(start, start + 20000); // expand window to capture more items
  const bulletRegex = /-\s*\[(.*?)\]\((https?:\/\/[^\)]+)\).*?/g;
  const items = [];
  let match;
  while ((match = bulletRegex.exec(slice)) && items.length < 100) {
    items.push({ title: match[1], url: match[2] });
  }
  return items;
}

// Extract country name from a talk title like "... in Country"
function extractCountry(title){
  const m = title.match(/\bin\s+([A-Za-z& ]+)\b/);
  if(!m) return null;
  return m[1].trim();
}

// Simple country center coordinates (lat, lon)
const COUNTRY_COORDS = {
  "Croatia": [45.1, 15.2],
  "Portugal": [39.5, -8.0],
  "Poland": [52.0, 19.0],
  "Greece": [39.0, 22.0],
  "Serbia": [44.0, 20.5],
  "Germany": [51.0, 10.0],
  "UK": [52.8, -1.6],
  "United Kingdom": [52.8, -1.6],
  "Lithuania": [55.2, 23.8],
  "Romania": [45.9, 24.9],
  "Bosnia & Herzegovina": [43.9, 17.7],
  "Bosnia and Herzegovina": [43.9, 17.7],
  "Denmark": [56.2, 9.5],
  "Belgium": [50.8, 4.7],
  "Norway": [61.0, 8.0],
  "Israel": [31.0, 35.0],
  "Ukraine": [49.0, 32.0],
  "Netherlands": [52.1, 5.3],
  "Italy": [42.8, 12.5],
  "Latvia": [57.0, 25.0],
  "South Africa": [-28.7, 24.7]
};

// Capital cities (lat, lon) used when no specific city is mentioned
const CAPITAL_COORDS = {
  "Croatia": [45.8150, 15.9819],         // Zagreb
  "Portugal": [38.7223, -9.1393],        // Lisbon
  "Poland": [52.2297, 21.0122],          // Warsaw
  "Greece": [37.9838, 23.7275],          // Athens
  "Serbia": [44.7866, 20.4489],          // Belgrade
  "Germany": [52.5200, 13.4050],         // Berlin
  "United Kingdom": [51.5074, -0.1278],  // London
  "Lithuania": [54.6872, 25.2797],       // Vilnius
  "Romania": [44.4268, 26.1025],         // Bucharest
  "Bosnia and Herzegovina": [43.8564, 18.4131], // Sarajevo
  "Denmark": [55.6761, 12.5683],         // Copenhagen
  "Belgium": [50.8503, 4.3517],          // Brussels
  "Norway": [59.9139, 10.7522],          // Oslo
  "Israel": [31.7683, 35.2137],          // Jerusalem
  "Ukraine": [50.4501, 30.5234],         // Kyiv
  "Netherlands": [52.3676, 4.9041],      // Amsterdam
  "Italy": [41.9028, 12.4964],           // Rome
  "Latvia": [56.9496, 24.1052],          // Riga
  "South Africa": [-25.7479, 28.2293]    // Pretoria
};

// City-level coordinates for known events (lat, lon)
const CITY_COORDS = {
  "London": [51.5074, -0.1278],
  "Berlin": [52.5200, 13.4050],
  "Munich": [48.1351, 11.5820],
  "Hamburg": [53.5511, 9.9937],
  "Porto": [41.1579, -8.6291],
  "Coimbra": [40.2110, -8.4292],
  "Lisbon": [38.7223, -9.1393],
  "Oslo": [59.9139, 10.7522],
  "Brussels": [50.8503, 4.3517],
  "Amsterdam": [52.3676, 4.9041],
  "Utrecht": [52.0907, 5.1214],
  "Odense": [55.4038, 10.4024],
  "Dresden": [51.0504, 13.7373],
  "Gdańsk": [54.3520, 18.6466],
  "Warsaw": [52.2297, 21.0122],
  "Cluj-Napoca": [46.7712, 23.6236],
  "Thessaloniki": [40.6401, 22.9444],
  "Ioannina": [39.6650, 20.8537],
  "Athens": [37.9838, 23.7275],
  "Belgrade": [44.7866, 20.4489],
  "Zagreb": [45.8150, 15.9819],
  "Split": [43.5081, 16.4402],
  "Riga": [56.9496, 24.1052],
  "Vilnius": [54.6872, 25.2797],
  "Verona": [45.4384, 10.9916],
  "Rome": [41.9028, 12.4964],
  "Tel Aviv": [32.0853, 34.7818],
  "Sarajevo": [43.8564, 18.4131],
  "Odessa": [46.4825, 30.7233],
  "San Francisco": [37.7749, -122.4194],
  "Greece": [39.0, 22.0]
};

// Country aliases normalization to handle README variations
const COUNTRY_ALIASES = {
  "UK": "United Kingdom",
  "U.K.": "United Kingdom",
  "Holland": "Netherlands",
  "Portuguese": "Portugal",
  "Bosnia & Herzegovina": "Bosnia and Herzegovina"
};

// City aliases to catch common misspellings/variants
const CITY_ALIASES = {
  "san fransicsco": "San Francisco",
  "san francisco": "San Francisco",
  "gdansk": "Gdańsk",
  "odesa": "Odessa"
};

// D3 globe with draggable rotation, wheel zoom, and pins
async function renderD3Globe(talks){
  const globeEl = document.getElementById("globe");
  if (!globeEl) return;
  globeEl.innerHTML = ""; // clear

  const w = globeEl.clientWidth || 280;
  const h = globeEl.clientHeight || 280;

  const svg = d3.select(globeEl).append("svg").attr("width", w).attr("height", h);

  // World map
  let worldFc;
  try {
    const res = await fetch("https://unpkg.com/world-atlas@2/countries-110m.json");
    const topo = await res.json();
    worldFc = topojson.feature(topo, topo.objects.countries);
  } catch (err) {
    console.warn("World atlas fetch failed:", err);
    worldFc = { type: "FeatureCollection", features: [] };
  }

  // Projection
  const projection = d3.geoMercator().fitExtent([[8,8],[w-8,h-8]], worldFc);
  const baseScale = projection.scale();
  projection.scale(baseScale * 2.3); // strong initial zoom for Europe detail (closer to previous feel)
  const path = d3.geoPath(projection);

  // Background
  svg.append("rect").attr("x",0).attr("y",0).attr("width",w).attr("height",h).attr("fill","#0a0a0a");

  // Land
  const land = svg.append("g")
    .selectAll("path")
    .data(worldFc.features)
    .join("path")
    .attr("d", path)
    .attr("fill", "#2e7db8")
    .attr("stroke", "#000")
    .attr("stroke-width", 1.2);

  // Graticule
  const graticule = d3.geoGraticule();
  const grat = svg.append("path")
    .datum(graticule())
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-opacity", 0.2);

  // Tooltip
  const tooltip = document.createElement("div");
  tooltip.className = "globe-tooltip";
  globeEl.appendChild(tooltip);

  // Normalize country names
  function normalizeCountry(name){
    if(!name) return null;
    const trimmed = name.trim();
    return COUNTRY_ALIASES[trimmed] || trimmed;
  }

  function coordsFromTitle(title){
    let lower = title.toLowerCase();

    // apply city alias normalization in text for matching
    for(const alias in CITY_ALIASES){
      if(lower.includes(alias)){
        const canonical = CITY_ALIASES[alias];
        lower = lower.replace(alias, canonical.toLowerCase());
      }
    }

    // city match first
    for(const city in CITY_COORDS){
      if(lower.includes(city.toLowerCase())){
        return CITY_COORDS[city];
      }
    }
    // country from "in X"
    const rawCountry = extractCountry(title);
    const norm = normalizeCountry(rawCountry);
    if(norm && CAPITAL_COORDS[norm]) return CAPITAL_COORDS[norm];
    if(norm && COUNTRY_COORDS[norm]) return COUNTRY_COORDS[norm];
    // any country text present
    for(const countryName in COUNTRY_COORDS){
      if(lower.includes(countryName.toLowerCase())){
        return CAPITAL_COORDS[countryName] || COUNTRY_COORDS[countryName];
      }
    }
    return null;
  }

  // Baseline countries to always show (capitals), derived from your list
  const DISPLAY_COUNTRIES = [
    "Croatia","Portugal","Poland","Greece","Serbia","Germany","United Kingdom",
    "Lithuania","Romania","Bosnia and Herzegovina","Denmark","Belgium","Norway",
    "Israel","Ukraine","Netherlands","Italy","Latvia","South Africa"
  ];
  const BASELINE_CITY_PINS = ["San Francisco"]; // ensure USA presence via city

  const baselinePins = [];
  DISPLAY_COUNTRIES.forEach(country=>{
    const coords = CAPITAL_COORDS[country] || COUNTRY_COORDS[country];
    if (coords) baselinePins.push({ talk: { title: country, url: "#" }, coords });
  });
  BASELINE_CITY_PINS.forEach(city=>{
    const coords = CITY_COORDS[city];
    if (coords) baselinePins.push({ talk: { title: city, url: "#" }, coords });
  });

  // Talks-derived pins
  const talkPins = talks.map(t => ({ talk: t, coords: coordsFromTitle(t.title) })).filter(d => d.coords);

  // Merge and de-duplicate by coordinates + title
  const seen = new Set();
  const pinData = [];
  [...baselinePins, ...talkPins].forEach(d=>{
    const key = `${d.talk.title}|${d.coords[0]},${d.coords[1]}`;
    if(!seen.has(key)){
      seen.add(key);
      pinData.push(d);
    }
  });

  const pins = svg.append("g")
    .selectAll("circle")
    .data(pinData, d => d.talk.title)
    .join("circle")
    .attr("r", 5)
    .attr("fill", "#ff3b3b")
    .attr("stroke", "#000")
    .attr("stroke-width", 2)
    .attr("cx", d => projection([d.coords[1], d.coords[0]])[0])
    .attr("cy", d => projection([d.coords[1], d.coords[0]])[1])
    .style("cursor", "pointer");

  pins.on("click", (_, d) => {
    const url = d.talk.url || "#";
    if(url && url !== "#") window.open(url, "_blank");
  });
  pins.on("mouseenter", (_, d) => {
    tooltip.textContent = d.talk.title;
    tooltip.style.opacity = "1";
  });
  pins.on("mousemove", (event) => {
    const rect = globeEl.getBoundingClientRect();
    tooltip.style.left = `${event.clientX - rect.left + 10}px`;
    tooltip.style.top = `${event.clientY - rect.top + 10}px`;
  });
  pins.on("mouseleave", () => {
    tooltip.style.opacity = "0";
  });

  // Drag rotate (horizontal and vertical; tuned to feel like previous version)
  let rotateX = 0;
  let rotateY = 0;
  const drag = d3.drag().on("drag", (event) => {
    rotateX += (event.dx / w) * 360;    // left/right
    rotateY += (event.dy / h) * 120;    // up/down, gentler than before
    rotateY = Math.max(-60, Math.min(60, rotateY)); // clamp tilt
    projection.rotate([rotateX, rotateY]);
    land.attr("d", path);
    grat.attr("d", path);
    pins.attr("cx", d => projection([d.coords[1], d.coords[0]])[0])
        .attr("cy", d => projection([d.coords[1], d.coords[0]])[1]);
  });
  svg.call(drag);

  // Wheel zoom (expanded max for deeper Europe zoom)
  const minScale = baseScale * 1.2;
  const maxScale = baseScale * 8.0;
  svg.on("wheel", (event) => {
    event.preventDefault();
    const delta = -event.deltaY;
    const factor = delta > 0 ? 1.1 : 0.92;
    let next = projection.scale() * factor;
    next = Math.max(minScale, Math.min(maxScale, next));
    projection.scale(next);
    land.attr("d", path);
    grat.attr("d", path);
    pins.attr("cx", d => projection([d.coords[1], d.coords[0]])[0])
        .attr("cy", d => projection([d.coords[1], d.coords[0]])[1]);
  }, { passive: false });
}

let latestTalksForPins = [];

async function renderSpeaking() {
  const container = document.getElementById("speaking-timeline");
  container.innerHTML = "";

  try {
    const res = await fetch(GH_README_RAW);
    if (!res.ok) throw new Error("README load error");
    const text = await res.text();
    const talks = parseSpeakingFromReadme(text);

    if (talks.length === 0) {
      container.innerHTML = "<div class='timeline-item left'>See GitHub README for full speaking list.</div>";
      await renderD3Globe([]);
      return;
    }

    // Show recent 6 in timeline
    const recent = talks.slice(0, 6);
    recent.forEach((t, i) => {
      const item = document.createElement("div");
      item.className = "timeline-item " + (i % 2 === 0 ? "left" : "right");
      item.innerHTML = `<a href="${t.url}" target="_blank" rel="noopener">${t.title}</a>`;
      container.appendChild(item);
      setTimeout(() => item.classList.add("visible"), 80 * i);
    });

    latestTalksForPins = talks;
    await renderD3Globe(talks);

  } catch (err) {
    console.error(err);
    container.innerHTML = "<div class='timeline-item left'>Unable to load speaking data.</div>";
    await renderD3Globe([]);
  }
}

function initPanels() {
  document.getElementById("panel-about").classList.add("active");
}

function revealOnScroll(selector){
  const els = document.querySelectorAll(selector);
  const io = new IntersectionObserver((entries)=>{
    entries.forEach((entry)=>{
      if(entry.isIntersecting){
        entry.target.classList.add("visible");
        io.unobserve(entry.target);
      }
    });
  },{threshold:0.15});
  els.forEach(el=>io.observe(el));
}

function initFooterVisibility(){
  const footer = document.querySelector(".footer");
  const backdrop = document.querySelector(".footer-backdrop");
  if(!footer) return;
  function update(){
    const reachedBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 4;
    if(reachedBottom){
      footer.classList.add("visible");
      if(backdrop) backdrop.classList.add("visible");
    } else {
      footer.classList.remove("visible");
      if(backdrop) backdrop.classList.remove("visible");
    }
  }
  window.addEventListener("scroll", update, {passive:true});
  window.addEventListener("resize", update);
  update();
}

async function init() {
  initPanels();
  await fetchGitHubProfile();
  await renderAboutDetails();
  await fetchVideos();
  await renderArticles();
  await renderSpeaking();
  revealOnScroll(".video-card, .article-item");
  initFooterVisibility();
}

document.addEventListener("DOMContentLoaded", init);