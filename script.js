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
  const items = [];
  let regex1 = /\[!\[.*?\]\]\((https:\/\/www\.youtube\.com\/watch\?v=[^)\s]+)\)\s*<br>\s*\[\*\*(.*?)\*\*\]\(\1\)/g;
  let m1;
  while ((m1 = regex1.exec(readmeText)) && items.length < 6) {
    items.push({ url: m1[1], title: m1[2] });
  }
  let regex2 = /\[\*\*(.*?)\*\*\]\((https:\/\/www\.youtube\.com\/watch\?v=[^)\s]+)\)/g;
  let m2;
  while ((m2 = regex2.exec(readmeText)) && items.length < 6) {
    items.push({ url: m2[2], title: m2[1] });
  }
  // Pattern 2b: standard markdown link [Title](youtube.com/watch?v=..)
  let regex2b = /\[(.*?)\]\((https:\/\/www\.youtube\.com\/watch\?v=[^)\s]+)\)/g;
  let m2b;
  while ((m2b = regex2b.exec(readmeText)) && items.length < 6) {
    items.push({ url: m2b[2], title: m2b[1] });
  }
  let regex3 = /(https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,}))/g;
  let seen = new Set(items.map(i => i.url));
  let m3;
  while ((m3 = regex3.exec(readmeText)) && items.length < 6) {
    if (!seen.has(m3[1])) {
      items.push({ url: m3[1], title: "YouTube Video" });
      seen.add(m3[1]);
    }
  }
  return items.map(i => ({
    ...i,
    thumb: `https://img.youtube.com/vi/${new URL(i.url).searchParams.get("v")}/hqdefault.jpg`,
    date: null
  }));
}

// Optional: YouTube RSS fallback (provide channel ID below to enable)
const YT_CHANNEL_ID = "UCC-WwYv3DEW7Nkm_IP6VeQQ"; // Eleftheria's channel ID
async function fetchYouTubeRSS(){
  if(!YT_CHANNEL_ID) return null;
  try{
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`);
    if(!res.ok) throw new Error("YouTube RSS error");
    const text = await res.text();
    const xml = new DOMParser().parseFromString(text, "application/xml");
    const entries = Array.from(xml.querySelectorAll("entry")).slice(0,4);
    return entries.map(e=>{
      const title = e.querySelector("title")?.textContent || "YouTube Video";
      const link = e.querySelector("link")?.getAttribute("href") || "";
      const v = link ? new URL(link).searchParams.get("v") : null;
      const thumb = v ? `https://img.youtube.com/vi/${v}/hqdefault.jpg` : "";
      return {title, url:link, thumb};
    });
  }catch(err){
    console.error(err);
    return null;
  }
}

async function fetchVideos() {
  const grid = document.getElementById("videos-grid");
  grid.innerHTML = "";

  try {
    // Try RSS first if channel ID provided (titles only, no dates)
    const rssVideos = await fetchYouTubeRSS();
    if(rssVideos && rssVideos.length){
      rssVideos.forEach((v, i)=>{
        const card = document.createElement("a");
        card.href = v.url; card.target = "_blank"; card.rel = "noopener";
        card.className = "video-card";
        card.innerHTML = `
          <img src="${v.thumb}" alt="">
          <div class="title">${v.title}</div>
        `;
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
      const card = document.createElement("a");
      card.href = v.url;
      card.target = "_blank";
      card.rel = "noopener";
      card.className = "video-card";
      card.innerHTML = `
        <img src="${v.thumb}" alt="">
        <div class="title">${v.title}</div>
      `;
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
    console.error(err);
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
  const slice = readmeText.slice(start, start + 6000);
  const bulletRegex = /-\s*\[(.*?)\]\((https?:\/\/[^\)]+)\).*?/g;
  const items = [];
  let match;
  while ((match = bulletRegex.exec(slice)) && items.length < 20) {
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
  "Latvia": [57.0, 25.0]
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

// Convert lat/lon to position on Mercator background box
function latLonToXY(lat, lon, width, height, offsetX=0){
  const x = ((lon + 180) / 360) * width + offsetX;
  const y = (height/2) - (height / (2*Math.PI)) * Math.log(Math.tan(Math.PI/4 + (lat*Math.PI/180)/2));
  return {x, y};
}

function findCoordsFromTitle(title){
  for(const city in CITY_COORDS){
    if(title.toLowerCase().includes(city.toLowerCase())){
      return CITY_COORDS[city];
    }
  }
  const country = extractCountry(title);
  if(country && COUNTRY_COORDS[country]) return COUNTRY_COORDS[country];
  return null;
}

function renderGlobePins(talks){
  const pinsEl = document.getElementById("globe-pins");
  const globeEl = document.getElementById("globe");
  pinsEl.innerHTML = "";
  const rect = globeEl.getBoundingClientRect();
  const w = rect.width, h = rect.height;

  talks.forEach((t)=>{
    const coords = findCoordsFromTitle(t.title);
    if(!coords) return;
    const {x, y} = latLonToXY(coords[0], coords[1], w, h, currentGlobeOffset);
    const pin = document.createElement("div");
    pin.className = "pin";
    pin.setAttribute("data-title", t.title);
    pin.setAttribute("data-url", t.url);
    pin.style.left = `${((x % w) + w) % w}px`;
    pin.style.top = `${Math.max(8, Math.min(h-8, y))}px`;
    pin.addEventListener("click", ()=>{
      const url = pin.getAttribute("data-url");
      if(url) window.open(url, "_blank");
    });
    pinsEl.appendChild(pin);
  });
}

// Drag-to-rotate globe horizontally with inertia
let currentGlobeOffset = 0;
let inertiaVelocity = 0;
let inertiaRAF = null;

function enableGlobeDrag(){
  const globeEl = document.getElementById("globe");
  let dragging = false;
  let lastX = 0;
  let lastTime = 0;

  function onMouseDown(e){
    dragging = true; lastX = e.clientX; lastTime = performance.now();
    cancelInertia();
  }
  function onMouseMove(e){
    if(!dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    const dt = now - lastTime;
    lastX = e.clientX; lastTime = now;
    currentGlobeOffset += dx;
    inertiaVelocity = dx / Math.max(dt, 16) * 16; // px per frame approx
    globeEl.style.backgroundPosition = `${currentGlobeOffset}px center`;
    if(latestTalksForPins.length) renderGlobePins(latestTalksForPins);
  }
  function onMouseUp(){
    dragging = false;
    startInertia();
  }

  globeEl.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  // Touch
  globeEl.addEventListener("touchstart", (e)=>{
    dragging = true; lastX = e.touches[0].clientX; lastTime = performance.now();
    cancelInertia();
  }, {passive:true});
  window.addEventListener("touchmove", (e)=>{
    if(!dragging) return;
    const now = performance.now();
    const dx = e.touches[0].clientX - lastX;
    const dt = now - lastTime;
    lastX = e.touches[0].clientX; lastTime = now;
    currentGlobeOffset += dx;
    inertiaVelocity = dx / Math.max(dt, 16) * 16;
    globeEl.style.backgroundPosition = `${currentGlobeOffset}px center`;
    if(latestTalksForPins.length) renderGlobePins(latestTalksForPins);
  }, {passive:true});
  window.addEventListener("touchend", ()=>{
    dragging = false;
    startInertia();
  });
}

function startInertia(){
  cancelInertia();
  const globeEl = document.getElementById("globe");
  function step(){
    // friction
    inertiaVelocity *= 0.95;
    if(Math.abs(inertiaVelocity) < 0.2){
      cancelInertia(); return;
    }
    currentGlobeOffset += inertiaVelocity;
    globeEl.style.backgroundPosition = `${currentGlobeOffset}px center`;
    if(latestTalksForPins.length) renderGlobePins(latestTalksForPins);
    inertiaRAF = requestAnimationFrame(step);
  }
  inertiaRAF = requestAnimationFrame(step);
}
function cancelInertia(){
  if(inertiaRAF){ cancelAnimationFrame(inertiaRAF); inertiaRAF = null; }
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
      return;
    }
    const recent = talks.slice(0, 6);
    latestTalksForPins = recent;

    recent.forEach((t, i) => {
      const item = document.createElement("div");
      item.className = "timeline-item " + (i % 2 === 0 ? "left" : "right");
      item.innerHTML = `<a href="${t.url}" target="_blank" rel="noopener">${t.title}</a>`;
      container.appendChild(item);
      setTimeout(() => item.classList.add("visible"), 80 * i);
    });

    renderGlobePins(recent);
    enableGlobeDrag();

  } catch (err) {
    console.error(err);
    container.innerHTML = "<div class='timeline-item left'>Unable to load speaking data.</div>";
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

async function init() {
  initPanels();
  await fetchGitHubProfile();
  await renderAboutDetails();
  await fetchVideos();
  await renderArticles();
  await renderSpeaking();
  revealOnScroll(".video-card, .article-item");
}

document.addEventListener("DOMContentLoaded", init);