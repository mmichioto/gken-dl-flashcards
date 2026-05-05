"use strict";

// ===== State =====
const State = {
  deck: null,
  selectedDomains: new Set(),
  selectedPriority: "all",
  selectedCount: 20,
  session: null,
};

const STORAGE_KEY = "gken_flashcard_progress_v1";
const THEME_KEY = "gken_flashcard_theme";

const DOMAIN_BADGE_CLASS = {
  "DL概要": "domain-overview",
  "DL応用例": "domain-application",
  "DL要素技術": "domain-element",
};

// ===== Storage =====
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessions: [], cardStats: {} };
    const p = JSON.parse(raw);
    return {
      sessions: p.sessions || [],
      cardStats: p.cardStats || {},
    };
  } catch {
    return { sessions: [], cardStats: {} };
  }
}

function saveProgress(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function recordResult(cardId, judge) {
  const p = loadProgress();
  const s = p.cardStats[cardId] || { right: 0, wrong: 0, skip: 0, lastAt: null };
  if (judge === "right") s.right += 1;
  else if (judge === "wrong") s.wrong += 1;
  else if (judge === "skip") s.skip += 1;
  s.lastAt = new Date().toISOString();
  s.lastJudge = judge;
  p.cardStats[cardId] = s;
  saveProgress(p);
}

function recordSession(summary) {
  const p = loadProgress();
  p.sessions.push({ ...summary, finishedAt: new Date().toISOString() });
  if (p.sessions.length > 50) p.sessions = p.sessions.slice(-50);
  saveProgress(p);
}

function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

// ===== Theme =====
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) document.documentElement.setAttribute("data-theme", saved);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme");
  const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const effective = cur || sys;
  const next = effective === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
}

// ===== Screens =====
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo({ top: 0, behavior: "instant" });
}

// ===== Init / Menu =====
async function loadDeck() {
  const res = await fetch("./cards.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("cards.json の読み込みに失敗");
  return res.json();
}

function buildDomainChips(deck) {
  const wrap = document.getElementById("domain-chips");
  wrap.innerHTML = "";

  const domains = [...new Set(deck.cards.map(c => c.domain))].sort();
  const counts = Object.fromEntries(domains.map(d => [d, deck.cards.filter(c => c.domain === d).length]));

  const allBtn = document.createElement("button");
  allBtn.className = "chip active";
  allBtn.dataset.domain = "__all__";
  allBtn.textContent = `すべて (${deck.cards.length})`;
  wrap.appendChild(allBtn);

  domains.forEach(d => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.dataset.domain = d;
    btn.textContent = `${d} (${counts[d]})`;
    wrap.appendChild(btn);
  });

  wrap.addEventListener("click", e => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    const d = btn.dataset.domain;
    if (d === "__all__") {
      State.selectedDomains.clear();
      [...wrap.children].forEach(c => c.classList.toggle("active", c === btn));
    } else {
      btn.classList.toggle("active");
      wrap.querySelector('[data-domain="__all__"]').classList.remove("active");
      if (btn.classList.contains("active")) State.selectedDomains.add(d);
      else State.selectedDomains.delete(d);
      if (State.selectedDomains.size === 0) {
        wrap.querySelector('[data-domain="__all__"]').classList.add("active");
      }
    }
  });
}

function bindChipGroup(containerId, key, parser = v => v) {
  const wrap = document.getElementById(containerId);
  wrap.addEventListener("click", e => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    [...wrap.children].forEach(c => c.classList.toggle("active", c === btn));
    State[key] = parser(btn.dataset[key.replace("selected", "").toLowerCase()]);
  });
}

function updateLastSessionInfo() {
  const p = loadProgress();
  const el = document.getElementById("last-session-info");
  if (!p.sessions.length) {
    el.textContent = "前回の学習履歴：未受講";
    return;
  }
  const last = p.sessions[p.sessions.length - 1];
  const at = new Date(last.finishedAt);
  const date = `${at.getMonth() + 1}/${at.getDate()} ${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  const total = last.right + last.wrong + last.skip;
  const rate = total ? Math.round((last.right / total) * 100) : 0;
  el.textContent = `前回 ${date}：${last.right}/${total} 正解（正答率 ${rate}%）`;
}

// ===== Session =====
function pickCards({ review = false } = {}) {
  let cards = State.deck.cards.slice();

  if (review) {
    const p = loadProgress();
    cards = cards.filter(c => {
      const s = p.cardStats[c.id];
      return s && s.lastJudge === "wrong";
    });
    if (cards.length === 0) {
      alert("間違えたカードはまだないで。普通モードで挑戦してみよか。");
      return null;
    }
    return shuffle(cards);
  }

  if (State.selectedDomains.size > 0) {
    cards = cards.filter(c => State.selectedDomains.has(c.domain));
  }
  if (State.selectedPriority !== "all") {
    cards = cards.filter(c => c.priority === State.selectedPriority);
  }
  if (cards.length === 0) {
    alert("条件に合うカードがないで、絞り込み変えてみてや。");
    return null;
  }
  cards = shuffle(cards);
  if (State.selectedCount !== "all") {
    cards = cards.slice(0, Number(State.selectedCount));
  }
  return cards;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startSession({ review = false } = {}) {
  const cards = pickCards({ review });
  if (!cards) return;
  State.session = {
    cards,
    index: 0,
    revealed: false,
    right: 0,
    wrong: 0,
    skip: 0,
    review,
  };
  showScreen("session");
  renderCard();
}

function renderCard() {
  const s = State.session;
  const c = s.cards[s.index];

  document.getElementById("progress-text").textContent = `${s.index + 1} / ${s.cards.length}`;
  document.getElementById("progress-fill").style.width = `${((s.index) / s.cards.length) * 100}%`;

  const dom = document.getElementById("card-domain");
  dom.textContent = c.domain;
  dom.className = "badge " + (DOMAIN_BADGE_CLASS[c.domain] || "");

  const pri = document.getElementById("card-priority");
  pri.textContent = c.priority;
  pri.className = "badge priority-" + c.priority;

  document.getElementById("card-category").textContent = c.category || "";
  document.getElementById("card-term").textContent = c.term || "";
  document.getElementById("card-front").textContent = c.front || "";

  document.getElementById("card-back").textContent = c.back || "";

  const trapEl = document.getElementById("card-trap-block");
  if (c.trap) {
    trapEl.classList.remove("hidden");
    document.getElementById("card-trap").textContent = c.trap;
  } else {
    trapEl.classList.add("hidden");
  }

  const relEl = document.getElementById("card-related-block");
  if (c.related && c.related.length) {
    relEl.classList.remove("hidden");
    document.getElementById("card-related").textContent = c.related.join("、");
  } else {
    relEl.classList.add("hidden");
  }

  const srcEl = document.getElementById("card-source");
  srcEl.textContent = c.source ? `出典：${c.source}` : "";

  document.getElementById("card-back-block").classList.add("hidden");
  document.getElementById("reveal-btn").classList.remove("hidden");
  document.getElementById("judge-row").classList.add("hidden");
  s.revealed = false;
}

function reveal() {
  document.getElementById("card-back-block").classList.remove("hidden");
  document.getElementById("reveal-btn").classList.add("hidden");
  document.getElementById("judge-row").classList.remove("hidden");
  State.session.revealed = true;
}

function judge(kind) {
  const s = State.session;
  const c = s.cards[s.index];
  if (kind === "right") s.right += 1;
  else if (kind === "wrong") s.wrong += 1;
  else if (kind === "skip") s.skip += 1;
  recordResult(c.id, kind);

  s.index += 1;
  if (s.index >= s.cards.length) finishSession();
  else renderCard();
}

function finishSession() {
  const s = State.session;
  recordSession({
    total: s.cards.length,
    right: s.right,
    wrong: s.wrong,
    skip: s.skip,
    review: s.review,
  });

  document.getElementById("result-right").textContent = s.right;
  document.getElementById("result-wrong").textContent = s.wrong;
  document.getElementById("result-skip").textContent = s.skip;
  const rate = s.cards.length ? Math.round((s.right / s.cards.length) * 100) : 0;
  document.getElementById("result-rate").textContent = `正答率 ${rate}%`;

  let comment;
  if (rate >= 90) comment = "ええ感じや殿、本番もこの調子で行きましょ 🎯";
  else if (rate >= 70) comment = "あと一押しやな。間違えたとこだけ復習しよ 💪";
  else if (rate >= 50) comment = "伸びしろやで殿、もう一周いっとこか 🔥";
  else comment = "今のうちにつまずいといて正解や、復習モードに入ろ 📚";
  document.getElementById("result-comment").textContent = comment;

  const reviewBtn = document.getElementById("result-review-btn");
  reviewBtn.style.display = s.wrong > 0 ? "" : "none";

  showScreen("result");
}

function quitSession() {
  if (confirm("セッションを途中で終わるで、ええか？")) {
    State.session = null;
    showScreen("menu");
    updateLastSessionInfo();
  }
}

// ===== Stats =====
function showStats() {
  const p = loadProgress();
  const summary = document.getElementById("stats-summary");
  const totalSessions = p.sessions.length;
  const totalRight = p.sessions.reduce((a, s) => a + s.right, 0);
  const totalWrong = p.sessions.reduce((a, s) => a + s.wrong, 0);
  const totalSkip = p.sessions.reduce((a, s) => a + s.skip, 0);
  const total = totalRight + totalWrong + totalSkip;
  const rate = total ? Math.round((totalRight / total) * 100) : 0;

  summary.innerHTML = `
    <div><strong>${totalSessions}</strong><span>セッション数</span></div>
    <div><strong>${total}</strong><span>解答数（延べ）</span></div>
    <div><strong>${rate}%</strong><span>累計正答率</span></div>
    <div><strong>${totalWrong}</strong><span>不正解（延べ）</span></div>
  `;

  const cardMap = Object.fromEntries(State.deck.cards.map(c => [c.id, c]));
  const weak = Object.entries(p.cardStats)
    .map(([id, s]) => {
      const total = s.right + s.wrong;
      const missRate = total ? s.wrong / total : 0;
      return { id, ...s, total, missRate };
    })
    .filter(x => x.wrong > 0)
    .sort((a, b) => b.missRate - a.missRate || b.wrong - a.wrong)
    .slice(0, 10);

  const weakList = document.getElementById("stats-weak");
  if (!weak.length) {
    weakList.innerHTML = '<li class="muted">まだデータが足りひんで。何セッションかこなしてみよ。</li>';
  } else {
    weakList.innerHTML = weak.map(w => {
      const c = cardMap[w.id];
      const term = c ? c.term : w.id;
      const pct = Math.round(w.missRate * 100);
      return `<li><strong>${escapeHtml(term)}</strong> <span class="miss-rate">誤答率 ${pct}%</span> <span class="muted">(${w.wrong}/${w.total})</span></li>`;
    }).join("");
  }

  showScreen("stats");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ===== Swipe gesture =====
function bindSwipe() {
  const area = document.getElementById("card-area");
  let startX = 0, startY = 0, startT = 0, tracking = false;

  area.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) return;
    tracking = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startT = Date.now();
  }, { passive: true });

  area.addEventListener("touchend", e => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const dt = Date.now() - startT;
    if (dt > 600) return;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    if (!State.session) return;
    if (!State.session.revealed) {
      reveal();
      return;
    }
    if (dx > 0) judge("right");
    else judge("wrong");
  }, { passive: true });
}

// ===== Keyboard shortcuts (PC) =====
function bindKeys() {
  document.addEventListener("keydown", e => {
    const onSession = document.getElementById("session").classList.contains("active");
    if (!onSession || !State.session) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (!State.session.revealed) {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); reveal(); }
    } else {
      if (e.key === "y" || e.key === "Y" || e.key === "ArrowRight") judge("right");
      else if (e.key === "n" || e.key === "N" || e.key === "ArrowLeft") judge("wrong");
      else if (e.key === "s" || e.key === "S") judge("skip");
    }
  });
}

// ===== Wire up =====
async function main() {
  initTheme();

  try {
    State.deck = await loadDeck();
  } catch (err) {
    document.body.innerHTML = `<p style="padding:24px;color:#dc2626;">cards.json の読み込みに失敗したで：${err.message}</p>`;
    return;
  }

  buildDomainChips(State.deck);

  document.getElementById("priority-chips").addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    [...b.parentElement.children].forEach(c => c.classList.toggle("active", c === b));
    State.selectedPriority = b.dataset.priority;
  });

  document.getElementById("count-chips").addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    [...b.parentElement.children].forEach(c => c.classList.toggle("active", c === b));
    const v = b.dataset.count;
    State.selectedCount = v === "all" ? "all" : Number(v);
  });

  document.getElementById("start-btn").addEventListener("click", () => startSession());
  document.getElementById("review-btn").addEventListener("click", () => startSession({ review: true }));
  document.getElementById("stats-btn").addEventListener("click", showStats);
  document.getElementById("reset-btn").addEventListener("click", () => {
    if (confirm("学習進捗を全部消すで、ほんまにええ？")) {
      resetProgress();
      updateLastSessionInfo();
      alert("リセットしたで。");
    }
  });

  document.getElementById("reveal-btn").addEventListener("click", reveal);
  document.getElementById("right-btn").addEventListener("click", () => judge("right"));
  document.getElementById("wrong-btn").addEventListener("click", () => judge("wrong"));
  document.getElementById("skip-btn").addEventListener("click", () => judge("skip"));
  document.getElementById("quit-btn").addEventListener("click", quitSession);

  document.getElementById("result-review-btn").addEventListener("click", () => startSession({ review: true }));
  document.getElementById("result-home-btn").addEventListener("click", () => {
    showScreen("menu");
    updateLastSessionInfo();
  });
  document.getElementById("stats-back-btn").addEventListener("click", () => {
    showScreen("menu");
    updateLastSessionInfo();
  });

  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

  bindSwipe();
  bindKeys();

  updateLastSessionInfo();
}

main();
