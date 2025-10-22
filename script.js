/**
 * Game-like portfolio interactions and dynamic content.
 * Pulls data from GitHub, Dev.to, Hashnode RSS, and README for recent videos.
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

// Fetch GitHub profile info
async function fetchGitHubProfile() {
  const bioEl = document.getElementById("bio");
  const nameEl = document.getElementById("name");
  const avatarEl = document.getElementById("avatar");
  const followersEl = document.getElementById("followers");
  const followingEl = document.getElementById("following");
  const reposEl = document.getElementById("repos");

  try {
    const res = await fetch(GH_PROFILE_API);
    if (!res.ok) throw new Error("GitHub API error");
    const data = await res.json();
    avatarEl.src = data.avatar_url;
    nameEl.textContent = data.name || data.login;
    bioEl.textContent = data.bio || "Developer Advocate and content creator.";
    followersEl.textContent = data.followers;
    followingEl.textContent = data.following;
    reposEl.textContent = data.public_repos;
  } catch (err) {
    bioEl.textContent = "Unable to load GitHub profile right now.";
    console.error(err);
  }
}

// Parse recent videos from README or fallback to YouTube thumbnails found in README
function parseVideosFromReadme(readmeText) {
  // The README has a "Recent YouTube Videos" section with a table of markdown images and links.
  // We'll extract up to 6 YouTube links and their titles.
  const sectionStart = readmeText.indexOf("Recent YouTube Videos");
  if (sectionStart === -1) return [];
  const slice = readmeText.slice(sectionStart, sectionStart + 8000);

  const linkRegex = /\[!\[.*?\]\]\((https:\/\/www\.youtube\.com\/watch\?v=[^)\s]+)\)\s*<br>\s*\[\*\*(.*?)\*\*\]\(\1\)/g;
  const items = [];
  let match;
  while ((match = linkRegex.exec(slice)) && items.length < 6) {
    items.push({
      url: match[1],
      title: match[2],
      thumb: `https://img.youtube.com/vi/${new URL(match[1]).searchParams.get("v")}/hqdefault.jpg`,
      date: null,
    });
  }
  return items;
}

async function fetchVideos() {
  const grid = document.getElementById("videos-grid");
  grid.innerHTML = "";

  try {
    const res = await fetch(GH_README_RAW);
    if (!res.ok) throw new Error("Failed to load README");
    const text = await res.text();
    let videos = parseVideosFromReadme(text);

    if (videos.length === 0) {
      // fallback: find any youtube links in README
      const genericRegex = /(https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})).*?\*\*\]?\)?/g;
      const fallback = [];
      let m;
      while ((m = genericRegex.exec(text)) && fallback.length < 6) {
        fallback.push({
          url: m[1],
          title: "YouTube Video",
          thumb: `https://img.youtube.com/vi/${m[2]}/hqdefault.jpg`,
          date: null,
        });
      }
      videos = fallback;
    }

    if (videos.length === 0) {
      grid.innerHTML = `<p>Could not find recent videos in the README. Visit <a href="https://www.youtube.com/c/eleftheriabatsou" target="_blank">YouTube</a>.</p>`;
      return;
    }

    videos.forEach((v) => {
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

  all.forEach((a) => {
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

async function renderSpeaking() {
  const ul = document.getElementById("speaking-list");
  ul.innerHTML = "";

  try {
    const res = await fetch(GH_README_RAW);
    if (!res.ok) throw new Error("README load error");
    const text = await res.text();
    const talks = parseSpeakingFromReadme(text);
    if (talks.length === 0) {
      ul.innerHTML = "<li>See GitHub README for full speaking list.</li>";
      return;
    }
    talks.slice(0, 20).forEach((t) => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="${t.url}" target="_blank" rel="noopener">${t.title}</a>`;
      ul.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    ul.innerHTML = "<li>Unable to load speaking data.</li>";
  }
}

function initPanels() {
  // open About by default
  document.getElementById("panel-about").classList.add("active");
}

async function init() {
  initPanels();
  await fetchGitHubProfile();
  await fetchVideos();
  await renderArticles();
  await renderSpeaking();
}

document.addEventListener("DOMContentLoaded", init);