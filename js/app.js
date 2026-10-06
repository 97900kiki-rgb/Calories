/* ============================================================
   app.js — NutriWrist AI
   스마트워치 AI 영양 분석 기능 (발표 자료 기반 인터랙티브 데모)
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 유틸 ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const num = (v) => Number(v) || 0;
  const fmt = (v) => Math.round(num(v)).toLocaleString('ko-KR');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round1 = (v) => Math.round(v * 10) / 10;
  const uid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const dayKey = (d) => {
    const x = d || new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  const clockKey = (d) => {
    const x = d || new Date();
    return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
  };
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }
  const MEAL_SLOTS = ['아침', '점심', '저녁', '간식'];
  function slotFromHour(h) {
    if (h < 11) return '아침';
    if (h < 16) return '점심';
    if (h < 21) return '저녁';
    return '간식';
  }

  /* ---------------- 상태 ---------------- */
  const state = {
    selectedFood: null,
    uploadedImage: null,
    lastResult: null,
    scanning: false,
    storage: 'unknown', // 'api' | 'local'
    meals: [],
    goal: { type: 'keep', weight: 62, height: 168, age: 27, gender: 'male', activity: 3, daily_kcal: 2000 },
    charts: {}
  };

  const LS_KEY = 'nutriwrist.v1.meals';
  const LS_GOAL = 'nutriwrist.v1.goal';

  /* ---------------- 토스트 ---------------- */
  function toast(msg, kind) {
    const stack = $('#toast-stack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'warn' ? ' warn' : '');
    const icon = kind === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-check';
    el.innerHTML = '<i class="fa-solid ' + icon + '" aria-hidden="true"></i><span></span>';
    el.lastElementChild.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, 3200);
  }

  /* ============================================================
     저장소 계층 — Table API 우선, 실패 시 localStorage 폴백
     ============================================================ */
  const API = { meals: 'tables/meals', goals: 'tables/goals' };

  async function apiList(table, limit) {
    const res = await fetch(`${API[table]}?limit=${limit || 200}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const rows = Array.isArray(json) ? json : (json.data || []);
    return rows.filter((r) => !r.deleted);
  }
  async function apiCreate(table, row) {
    const res = await fetch(API[table], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }
  async function apiDelete(table, id) {
    const res = await fetch(`${API[table]}/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error('HTTP ' + res.status);
    return true;
  }

  function localRead() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { return []; }
  }
  function localWrite(rows) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(rows)); } catch (e) { /* 무시 */ }
  }
  function localGoalRead() {
    try { return JSON.parse(localStorage.getItem(LS_GOAL) || 'null'); } catch (e) { return null; }
  }
  function localGoalWrite(g) {
    try { localStorage.setItem(LS_GOAL, JSON.stringify(g)); } catch (e) { /* 무시 */ }
  }

  function setStorageUI(mode) {
    state.storage = mode;
    const el = $('#storage-state');
    if (!el) return;
    if (mode === 'api') {
      el.className = 'storage-state online';
      el.innerHTML = '<i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> 테이블 API 연결됨 — 기록이 서버에 저장됩니다.';
    } else {
      el.className = 'storage-state offline';
      el.innerHTML = '<i class="fa-solid fa-hard-drive" aria-hidden="true"></i> 로컬 모드 — 이 브라우저에만 저장됩니다.';
    }
  }

  async function loadMeals() {
    try {
      const rows = await apiList('meals', 300);
      state.storage = 'api';
      state.meals = rows.map(normalizeRow);
      setStorageUI('api');
    } catch (e) {
      state.storage = 'local';
      state.meals = localRead().map(normalizeRow);
      setStorageUI('local');
    }
  }

  function normalizeRow(r) {
    return {
      id: r.id || uid(),
      food_id: r.food_id || '',
      name: r.name || '음식',
      emoji: r.emoji || '🍽️',
      image: r.image || '',
      kcal: num(r.kcal),
      carbs: num(r.carbs),
      protein: num(r.protein),
      fat: num(r.fat),
      meal_time: r.meal_time || '간식',
      day: r.day || dayKey(),
      logged_at: r.logged_at || clockKey(),
      allergens: r.allergens || '',
      source: r.source || 'user'
    };
  }

  async function addMeal(row) {
    if (state.storage === 'api') {
      try {
        const saved = await apiCreate('meals', row);
        state.meals.push(normalizeRow(Object.assign({}, row, saved || {})));
        return true;
      } catch (e) {
        state.storage = 'local';
        setStorageUI('local');
        toast('서버 저장에 실패해 로컬에 저장했습니다.', 'warn');
      }
    }
    state.meals.push(normalizeRow(row));
    localWrite(state.meals);
    return true;
  }

  async function removeMeal(id) {
    state.meals = state.meals.filter((m) => m.id !== id);
    if (state.storage === 'api') {
      try { await apiDelete('meals', id); } catch (e) { /* 로컬에도 반영 */ }
    }
    localWrite(state.meals);
  }

  async function clearMeals() {
    const ids = state.meals.map((m) => m.id);
    state.meals = [];
    localWrite([]);
    if (state.storage === 'api') {
      for (const id of ids) {
        try { await apiDelete('meals', id); } catch (e) { /* 무시 */ }
      }
    }
  }

  /* ============================================================
     집계
     ============================================================ */
  function mealsOfDay(day) {
    return state.meals.filter((m) => m.day === day);
  }
  function sumMacros(rows) {
    return rows.reduce((a, m) => {
      a.kcal += m.kcal; a.carbs += m.carbs; a.protein += m.protein; a.fat += m.fat;
      return a;
    }, { kcal: 0, carbs: 0, protein: 0, fat: 0 });
  }

  /* ============================================================
     히어로 / 워치 UI
     ============================================================ */
  function renderWatch() {
    const today = mealsOfDay(dayKey());
    const t = sumMacros(today);
    const goal = state.goal.daily_kcal || 2000;
    const pct = clamp((t.kcal / goal) * 100, 0, 100);

    const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    set('#watch-kcal', fmt(t.kcal));
    set('#watch-goal', fmt(goal));
    set('#watch-pct', Math.round(pct) + '%');
    set('#watch-carb', fmt(t.carbs));
    set('#watch-pro', fmt(t.protein));
    set('#watch-fat', fmt(t.fat));
    set('#chip-kcal', fmt(t.kcal) + ' kcal');

    const ring = $('#watch-ring');
    if (ring) {
      ring.style.strokeDashoffset = String(327 - (327 * pct) / 100);
      ring.style.stroke = pct >= 100 ? '#fbbf24' : (pct > 80 ? '#4ade80' : '#22d3ee');
    }
  }

  /* ============================================================
     대시보드
     ============================================================ */
  function renderDashboard() {
    const today = mealsOfDay(dayKey());
    const t = sumMacros(today);
    const goal = state.goal.daily_kcal || 2000;
    const pct = clamp((t.kcal / goal) * 100, 0, 100);

    const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    set('#dash-kcal', fmt(t.kcal));
    set('#dash-goal', fmt(goal));
    set('#dash-pct', Math.round(pct) + '%');
    set('#dash-carb', fmt(t.carbs) + 'g');
    set('#dash-pro', fmt(t.protein) + 'g');
    set('#dash-fat', fmt(t.fat) + 'g');
    set('#dash-remain', fmt(Math.max(0, goal - t.kcal)) + ' kcal');

    const ring = $('#goal-ring-value');
    if (ring) {
      ring.style.strokeDashoffset = String(540 - (540 * pct) / 100);
      ring.style.stroke = pct > 110 ? '#fb7185' : (pct >= 100 ? '#fbbf24' : '#4ade80');
    }

    const note = $('#dash-note');
    if (note) {
      if (today.length === 0) {
        note.textContent = '아직 오늘 기록이 없습니다. AI 분석 결과를 식단에 기록해 보세요.';
      } else if (t.kcal > goal) {
        note.textContent = `목표를 ${fmt(t.kcal - goal)} kcal 초과했습니다. 운동 제안에서 소모 계획을 확인하세요.`;
      } else {
        note.textContent = `${today.length}끼 기록 · 목표까지 ${fmt(goal - t.kcal)} kcal 남았습니다.`;
      }
    }

    renderMealList(today);
    renderMealChart(today);
    renderWeekChart();
    renderReport();
    renderWorkouts();
    renderWatch();

    const badge = $('#meal-count');
    if (badge) badge.textContent = String(today.length);
  }

  function renderMealList(rows) {
    const list = $('#meal-list');
    const empty = $('#meal-empty');
    if (!list) return;
    list.innerHTML = '';
    if (!rows.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    rows.slice().sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1)).forEach((m) => {
      const li = document.createElement('li');
      li.className = 'meal-item';
      const thumb = m.image
        ? '<img src="' + m.image + '" alt="" loading="lazy" />'
        : '<span>' + m.emoji + '</span>';
      li.innerHTML =
        '<span class="meal-thumb">' + thumb + '</span>' +
        '<span class="meal-info">' +
          '<span class="meal-name">' + escapeHtml(m.name) + '</span>' +
          '<span class="meal-sub">' +
            '<span class="meal-time-tag">' + m.meal_time + '</span>' +
            '<span>' + m.logged_at + '</span>' +
            '<span>탄 ' + fmt(m.carbs) + 'g · 단 ' + fmt(m.protein) + 'g · 지 ' + fmt(m.fat) + 'g</span>' +
          '</span>' +
        '</span>' +
        '<span class="meal-right">' +
          '<span class="meal-kcal">' + fmt(m.kcal) + ' kcal</span>' +
          '<button class="meal-del" type="button" aria-label="' + escapeHtml(m.name) + ' 기록 삭제" data-id="' + m.id + '">' +
            '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' +
          '</button>' +
        '</span>';
      list.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /* ============================================================
     Chart.js
     ============================================================ */
  function chartReady() {
    return typeof window.Chart !== 'undefined';
  }
  function prepChart(key) {
    if (state.charts[key]) { state.charts[key].destroy(); state.charts[key] = null; }
  }

  function renderMealChart(rows) {
    if (!chartReady()) return;
    const canvas = $('#meal-chart');
    if (!canvas) return;
    prepChart('meal');

    const carbs = [], protein = [], fat = [];
    MEAL_SLOTS.forEach((slot) => {
      const s = sumMacros(rows.filter((m) => m.meal_time === slot));
      carbs.push(round1(s.carbs));
      protein.push(round1(s.protein));
      fat.push(round1(s.fat));
    });

    state.charts.meal = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: MEAL_SLOTS,
        datasets: [
          { label: '탄수화물(g)', data: carbs, backgroundColor: 'rgba(251,191,36,.85)', borderRadius: 6, stack: 'm' },
          { label: '단백질(g)', data: protein, backgroundColor: 'rgba(34,211,238,.85)', borderRadius: 6, stack: 'm' },
          { label: '지방(g)', data: fat, backgroundColor: 'rgba(251,113,133,.85)', borderRadius: 6, stack: 'm' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, color: '#93a2ba', font: { size: 11 } } },
          tooltip: {
            backgroundColor: 'rgba(10,16,32,.95)', borderColor: 'rgba(255,255,255,.14)', borderWidth: 1,
            callbacks: { label: (c) => ' ' + c.dataset.label + ' ' + c.parsed.y + 'g' }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: '#93a2ba' } },
          y: {
            stacked: true, beginAtZero: true,
            grid: { color: 'rgba(255,255,255,.06)' }, ticks: { color: '#6b7a93', callback: (v) => v + 'g' }
          }
        }
      }
    });
  }

  function renderWeekChart() {
    if (!chartReady()) return;
    const canvas = $('#week-chart');
    if (!canvas) return;
    prepChart('week');

    const labels = [], values = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(['일', '월', '화', '수', '목', '금', '토'][d.getDay()]);
      values.push(Math.round(sumMacros(mealsOfDay(dayKey(d))).kcal));
    }
    const goal = state.goal.daily_kcal || 2000;
    const colors = values.map((v) => (v === 0 ? 'rgba(255,255,255,.10)' : v > goal ? 'rgba(251,113,133,.85)' : 'rgba(74,222,128,.85)'));

    state.charts.week = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { type: 'bar', label: '섭취 kcal', data: values, backgroundColor: colors, borderRadius: 8, order: 2 },
          {
            type: 'line', label: '목표 kcal', data: labels.map(() => goal),
            borderColor: 'rgba(34,211,238,.9)', borderWidth: 2, borderDash: [6, 5],
            pointRadius: 0, tension: 0, order: 1
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, color: '#93a2ba', font: { size: 11 } } },
          tooltip: {
            backgroundColor: 'rgba(10,16,32,.95)', borderColor: 'rgba(255,255,255,.14)', borderWidth: 1,
            callbacks: { label: (c) => ' ' + c.dataset.label + ' ' + fmt(c.parsed.y) + ' kcal' }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#93a2ba' } },
          y: {
            beginAtZero: true, grid: { color: 'rgba(255,255,255,.06)' },
            ticks: { color: '#6b7a93', callback: (v) => fmt(v) }
          }
        }
      }
    });
  }

  function renderReport() {
    const list = $('#report-list');
    if (!list) return;
    const goal = state.goal.daily_kcal || 2000;
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      days.push({ key: k, kcal: Math.round(sumMacros(mealsOfDay(k)).kcal) });
    }
    const logged = days.filter((d) => d.kcal > 0);
    const avg = logged.length ? Math.round(logged.reduce((a, d) => a + d.kcal, 0) / logged.length) : 0;
    const onTarget = logged.filter((d) => d.kcal <= goal && d.kcal >= goal * 0.7).length;
    const best = logged.slice().sort((a, b) => Math.abs(a.kcal - goal) - Math.abs(b.kcal - goal))[0];
    const t = sumMacros(mealsOfDay(dayKey()));

    const rows = [
      ['fa-chart-simple', '기록한 날', logged.length + '일 / 7일'],
      ['fa-calculator', '일평균 섭취', logged.length ? fmt(avg) + ' kcal' : '—'],
      ['fa-bullseye', '목표 범위 달성', onTarget + '일'],
      ['fa-trophy', '가장 균형 잡힌 날', best ? best.key.slice(5).replace('-', '/') + ' (' + fmt(best.kcal) + ' kcal)' : '—'],
      ['fa-scale-balanced', '오늘 탄단지 비율', t.kcal ? macroRatioText(t) : '—']
    ];

    list.innerHTML = rows.map((r) =>
      '<li><i class="fa-solid ' + r[0] + '" aria-hidden="true"></i> ' + r[1] + ' <b>' + r[2] + '</b></li>'
    ).join('');
  }

  function macroRatioText(t) {
    const c = t.carbs * 4, p = t.protein * 4, f = t.fat * 9;
    const total = c + p + f || 1;
    return [Math.round((c / total) * 100), Math.round((p / total) * 100), Math.round((f / total) * 100)].join(' : ');
  }

  /* ============================================================
     AI 분석 랩
     ============================================================ */
  function renderFoodPicker() {
    const box = $('#food-picker');
    if (!box) return;
    box.innerHTML = '';
    window.FOOD_DB.forEach((f) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'food-chip';
      btn.setAttribute('role', 'listitem');
      btn.dataset.id = f.id;
      btn.innerHTML =
        '<span class="fc-emoji" aria-hidden="true">' + f.emoji + '</span>' +
        '<span class="fc-name">' + escapeHtml(f.name) + '</span>' +
        '<span class="fc-kcal">' + fmt(f.kcal) + ' kcal</span>';
      btn.addEventListener('click', () => selectFood(f.id));
      box.appendChild(btn);
    });
  }

  function selectFood(id) {
    const food = window.FOOD_DB.find((f) => f.id === id) || null;
    state.selectedFood = food;
    $$('#food-picker .food-chip').forEach((el) => {
      el.classList.toggle('is-active', !!food && el.dataset.id === id);
    });
    if (food && !state.uploadedImage) {
      setScanImage(food.image, food.name);
    }
    const btn = $('#analyze-btn');
    if (btn) btn.disabled = false;
  }

  function setScanImage(src, alt) {
    const img = $('#scan-img');
    const ph = $('#scan-placeholder');
    if (!img) return;
    img.classList.remove('is-loaded');
    img.alt = alt || '분석 대상 음식 사진';
    img.onload = () => {
      img.classList.add('is-loaded');
      if (ph) ph.style.display = 'none';
    };
    img.onerror = () => {
      img.classList.remove('is-loaded');
      if (ph) { ph.style.display = ''; }
    };
    img.src = src;
  }

  function resetScanImage() {
    const img = $('#scan-img');
    const ph = $('#scan-placeholder');
    if (img) { img.removeAttribute('src'); img.classList.remove('is-loaded'); }
    if (ph) ph.style.display = '';
  }

  function pickFoodFromHash(seed) {
    const h = hash(seed);
    return window.FOOD_DB[h % window.FOOD_DB.length];
  }

  function setProgress(p) {
    const bar = $('#scan-bar');
    if (bar) bar.style.width = clamp(p, 0, 100) + '%';
  }

  async function runAnalysis() {
    if (state.scanning) return;

    const hasUpload = !!state.uploadedImage;
    const food = state.selectedFood || (hasUpload ? pickFoodFromHash(state.uploadedImage.slice(-256) + state.uploadedImage.length) : null);

    if (!food) {
      toast('샘플 음식을 선택하거나 사진을 업로드해 주세요.', 'warn');
      return;
    }

    if (hasUpload && !state.selectedFood) {
      setScanImage(state.uploadedImage, '업로드한 음식 사진');
    } else if (!hasUpload) {
      setScanImage(food.image, food.name);
    }

    state.scanning = true;
    const scanner = $('#scanner');
    const btn = $('#analyze-btn');
    if (scanner) scanner.classList.add('is-scanning');
    if (btn) btn.disabled = true;
    setProgress(0);

    const emptyEl = $('#result-empty');
    const bodyEl = $('#result-body');
    if (bodyEl) bodyEl.hidden = true;
    if (emptyEl) {
      emptyEl.style.display = '';
      emptyEl.querySelector('p').textContent = 'AI가 이미지를 분석하고 있습니다…';
    }

    // 분석 진행률 애니메이션
    await new Promise((resolve) => {
      let p = 0;
      const timer = setInterval(() => {
        p += 4 + Math.random() * 9;
        setProgress(p);
        if (p >= 100) { clearInterval(timer); resolve(); }
      }, 90);
    });

    if (scanner) scanner.classList.remove('is-scanning');
    setProgress(100);

    const seed = food.id + '|' + (hasUpload ? String(state.uploadedImage.length) : 'sample');
    const h = hash(seed);
    const confidence = round1(88 + (h % 100) / 10 - (hasUpload && !state.selectedFood ? 4 : 0));
    const portion = 0.85 + (h % 30) / 100; // 0.85 ~ 1.15 인분 보정

    const result = {
      food,
      confidence,
      portion,
      kcal: Math.round(food.kcal * portion),
      carbs: round1(food.carbs * portion),
      protein: round1(food.protein * portion),
      fat: round1(food.fat * portion)
    };
    state.lastResult = result;

    if (emptyEl) emptyEl.style.display = 'none';
    if (bodyEl) bodyEl.hidden = false;
    renderResult(result);

    state.scanning = false;
    if (btn) btn.disabled = false;
    toast(food.name + ' 분석 완료 — ' + fmt(result.kcal) + ' kcal');
  }

  function renderResult(r) {
    const f = r.food;
    const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    set('#r-name', f.name);
    $('#r-conf').innerHTML = 'AI 신뢰도 <b>' + r.confidence.toFixed(1) + '%</b> · 추정 ' + r.portion.toFixed(2) + '인분';
    $('#r-kcal').innerHTML = fmt(r.kcal) + '<small>kcal</small>';

    // 매크로 바
    const c = r.carbs * 4, p = r.protein * 4, ft = r.fat * 9;
    const total = c + p + ft || 1;
    const rows = [
      ['탄수화물', r.carbs, Math.round((c / total) * 100), 'f-carb'],
      ['단백질', r.protein, Math.round((p / total) * 100), 'f-pro'],
      ['지방', r.fat, Math.round((ft / total) * 100), 'f-fat']
    ];
    const box = $('#r-macros');
    box.innerHTML = rows.map((row) =>
      '<div class="macro-row">' +
        '<span class="m-label">' + row[0] + '</span>' +
        '<span class="macro-track"><span class="macro-fill ' + row[3] + '" data-w="' + row[2] + '"></span></span>' +
        '<span class="m-val">' + row[1].toFixed(1) + 'g</span>' +
      '</div>'
    ).join('');
    requestAnimationFrame(() => {
      $$('#r-macros .macro-fill').forEach((el) => { el.style.width = el.dataset.w + '%'; });
    });

    // 미량 영양소
    const micro = $('#r-micro');
    micro.innerHTML = Object.keys(f.micro).map((k) =>
      '<span class="nutri-chip">' + k + ' <b>' + f.micro[k] + '</b></span>'
    ).join('');

    // 알레르기 판정
    const hits = f.allergens.filter((a) => window.USER_ALLERGENS.indexOf(a) !== -1);
    const allergy = $('#r-allergy');
    if (hits.length) {
      allergy.innerHTML =
        '<div class="allergy-note warn">' +
          '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>' +
          '<div><strong>알레르기 주의 성분 ' + hits.length + '건 감지</strong>' +
          '내 프로필과 일치: ' + hits.join(', ') + ' — 섭취 전 확인이 필요합니다.</div>' +
        '</div>';
    } else {
      allergy.innerHTML =
        '<div class="allergy-note safe">' +
          '<i class="fa-solid fa-shield-heart" aria-hidden="true"></i>' +
          '<div><strong>알레르기 위험 없음</strong>' +
          '내 프로필(' + window.USER_ALLERGENS.join(', ') + ') 기준 감지된 성분이 없습니다.</div>' +
        '</div>';
    }

    // 포함 성분 전체 표시
    const chips = $('#r-micro');
    if (chips) {
      chips.insertAdjacentHTML('beforeend',
        '<span class="nutri-chip is-ok">포함 성분 <b>' + f.allergens.join(' · ') + '</b></span>');
    }
  }

  async function logResult() {
    const r = state.lastResult;
    if (!r) return;
    const now = new Date();
    const row = {
      id: uid(),
      food_id: r.food.id,
      name: r.food.name,
      emoji: r.food.emoji,
      image: r.food.image,
      kcal: r.kcal,
      carbs: r.carbs,
      protein: r.protein,
      fat: r.fat,
      meal_time: slotFromHour(now.getHours()),
      day: dayKey(now),
      logged_at: clockKey(now),
      allergens: r.food.allergens.join(','),
      source: 'user'
    };
    await addMeal(row);
    renderDashboard();
    toast(row.meal_time + '에 ' + r.food.name + ' ' + fmt(r.kcal) + ' kcal 기록');
  }

  /* ============================================================
     운동 제안
     ============================================================ */
  function renderWorkouts() {
    const grid = $('#workout-grid');
    if (!grid) return;

    const target = num($('#burn-kcal') ? $('#burn-kcal').value : 320);
    const weight = state.goal.weight || 62;
    const todayKcal = sumMacros(mealsOfDay(dayKey())).kcal;
    const goal = state.goal.daily_kcal || 2000;

    const setT = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    setT('#burn-today', fmt(todayKcal) + ' kcal');
    setT('#burn-over', fmt(Math.max(0, todayKcal - goal)) + ' kcal');

    const items = window.WORKOUT_DB.map((w) => {
      const perMin = (w.met * 3.5 * weight) / 200; // kcal / min
      const minutes = Math.max(5, Math.round(target / perMin));
      const burn = Math.round(perMin * minutes);
      return { w, perMin, minutes, burn };
    }).sort((a, b) => b.perMin - a.perMin);

    const maxPerMin = Math.max.apply(null, items.map((i) => i.perMin)) || 1;

    grid.innerHTML = items.map((i) =>
      '<article class="workout-card">' +
        '<header class="wo-head">' +
          '<span class="wo-ico" aria-hidden="true">' + i.w.emoji + '</span>' +
          '<span>' +
            '<span class="wo-name">' + i.w.name + '</span><br />' +
            '<span class="wo-int">' + i.w.intensity + ' · ' + i.w.note + '</span>' +
          '</span>' +
        '</header>' +
        '<div class="wo-metrics">' +
          '<span class="wo-metric"><span>소요 시간</span><strong>' + i.minutes + '<small>분</small></strong></span>' +
          '<span class="wo-metric"><span>예상 소모</span><strong>' + fmt(i.burn) + '<small>kcal</small></strong></span>' +
          '<span class="wo-metric"><span>MET</span><strong>' + i.w.met.toFixed(1) + '</strong></span>' +
        '</div>' +
        '<div class="wo-bar"><span style="width:' + Math.round((i.perMin / maxPerMin) * 100) + '%"></span></div>' +
      '</article>'
    ).join('');
  }

  function bindBurnControls() {
    const range = $('#burn-range');
    const input = $('#burn-kcal');
    if (!range || !input) return;

    const sync = (v, from) => {
      const val = clamp(Math.round(num(v) || 0), 20, 1500);
      if (from !== 'range') range.value = clamp(val, 50, 900);
      if (from !== 'input') input.value = val;
      renderWorkouts();
    };
    range.addEventListener('input', () => sync(range.value, 'range'));
    input.addEventListener('input', () => sync(input.value, 'input'));

    const logBtn = $('#log-btn');
    if (logBtn) logBtn.addEventListener('click', logResult);

    // 오늘 섭취량이 있으면 그 값을 기본 소모 목표로
    const todayKcal = Math.round(sumMacros(mealsOfDay(dayKey())).kcal);
    const goal = state.goal.daily_kcal || 2000;
    if (todayKcal > goal) sync(todayKcal - goal, 'both');
  }

  /* ============================================================
     목표 설정
     ============================================================ */
  function computeGoal() {
    const g = state.goal;
    const bmr = g.gender === 'female'
      ? 10 * g.weight + 6.25 * g.height - 5 * g.age - 161
      : 10 * g.weight + 6.25 * g.height - 5 * g.age + 5;
    const factor = window.ACTIVITY_FACTORS[g.activity] || 1.55;
    const tdee = bmr * factor;
    const preset = window.GOAL_PRESETS[g.type] || window.GOAL_PRESETS.keep;
    const target = Math.round((tdee * preset.factor) / 10) * 10;
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), target };
  }

  function applyGoal(showToast) {
    const out = computeGoal();
    state.goal.daily_kcal = out.target;

    const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    set('#out-bmr', fmt(out.bmr) + ' kcal');
    set('#out-tdee', fmt(out.tdee) + ' kcal');
    set('#out-target', fmt(out.target) + ' kcal');
    set('#watch-goal', fmt(out.target));
    set('#dash-goal', fmt(out.target));

    localGoalWrite(state.goal);
    renderDashboard();

    if (showToast) {
      const p = window.GOAL_PRESETS[state.goal.type];
      toast('AI가 ' + p.label + ' 목표를 ' + fmt(out.target) + ' kcal로 설정했습니다.');
    }
  }

  function bindSegmented(id, key, parse) {
    const box = $('#' + id);
    if (!box) return;
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('.seg');
      if (!btn) return;
      $$('.seg', box).forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-checked', active ? 'true' : 'false');
      });
      state.goal[key] = parse ? parse(btn.dataset.value) : btn.dataset.value;
      applyGoal(false);
    });
  }

  function bindGoalForm() {
    bindSegmented('goal-type', 'type');
    bindSegmented('activity', 'activity', Number);
    bindSegmented('gender', 'gender');

    const pairs = [['#in-weight', 'weight'], ['#in-height', 'height'], ['#in-age', 'age']];
    pairs.forEach(([sel, key]) => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener('input', () => {
        state.goal[key] = num(el.value) || state.goal[key];
        applyGoal(false);
      });
    });

    const saveBtn = $('#goal-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      applyGoal(true);
      const r = computeGoal();
      const g = state.goal;
      const row = {
        id: 'goal-' + (g.gender === 'female' ? 'f' : 'm') + '-' + g.type,
        goal_type: g.type,
        daily_kcal: r.target,
        activity_level: g.activity,
        updated: new Date().toISOString()
      };
      if (state.storage === 'api') {
        fetch(API.goals, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row)
        }).catch(() => { /* 폴백: 로컬에 이미 저장됨 */ });
      }
    });
  }

  function loadGoal() {
    const saved = localGoalRead();
    if (saved) {
      Object.assign(state.goal, saved);
      // 폼 반영
      const seg = (id, val) => {
        const box = $('#' + id);
        if (!box) return;
        $$('.seg', box).forEach((b) => {
          const active = b.dataset.value === String(val);
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-checked', active ? 'true' : 'false');
        });
      };
      seg('goal-type', state.goal.type);
      seg('activity', state.goal.activity);
      seg('gender', state.goal.gender);
      const w = $('#in-weight'); if (w) w.value = state.goal.weight;
      const h = $('#in-height'); if (h) h.value = state.goal.height;
      const a = $('#in-age'); if (a) a.value = state.goal.age;
    }
    applyGoal(false);
  }

  /* ============================================================
     예시 데이터
     ============================================================ */
  async function loadDemo() {
    const plan = [
      { d: 6, items: [['salad', '점심'], ['chicken', '저녁']] },
      { d: 5, items: [['bibimbap', '점심'], ['ramen', '저녁']] },
      { d: 4, items: [['chicken', '아침'], ['pizza', '저녁']] },
      { d: 3, items: [['salad', '아침'], ['bibimbap', '점심'], ['chicken', '저녁']] },
      { d: 2, items: [['burger', '점심'], ['salad', '저녁']] },
      { d: 1, items: [['bibimbap', '점심'], ['ramen', '간식']] },
      { d: 0, items: [['salad', '아침'], ['chicken', '점심']] }
    ];
    const times = { '아침': '08:20', '점심': '12:40', '저녁': '19:10', '간식': '16:05' };

    for (const day of plan) {
      const dt = new Date();
      dt.setDate(dt.getDate() - day.d);
      for (const [fid, slot] of day.items) {
        const food = window.FOOD_DB.find((f) => f.id === fid);
        if (!food) continue;
        const scale = 0.85 + (hash(fid + day.d + slot) % 30) / 100;
        await addMeal({
          id: uid(),
          food_id: food.id,
          name: food.name,
          emoji: food.emoji,
          image: food.image,
          kcal: Math.round(food.kcal * scale),
          carbs: round1(food.carbs * scale),
          protein: round1(food.protein * scale),
          fat: round1(food.fat * scale),
          meal_time: slot,
          day: dayKey(dt),
          logged_at: times[slot] || '12:00',
          allergens: food.allergens.join(','),
          source: 'demo'
        });
      }
    }
    renderDashboard();
    toast('최근 7일 예시 데이터를 불러왔습니다.');
  }

  /* ============================================================
     업로드
     ============================================================ */
  function bindUpload() {
    const input = $('#photo-input');
    const zone = $('#upload-zone');
    const hint = $('#upload-hint');
    if (!input) return;

    const handle = (file) => {
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        toast('이미지 파일만 업로드할 수 있습니다.', 'warn');
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast('8MB 이하 이미지를 사용해 주세요.', 'warn');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        state.uploadedImage = String(ev.target.result);
        // 업로드 시에는 선택 해제하고 이미지 자체를 분석 대상으로 사용
        state.selectedFood = null;
        $$('#food-picker .food-chip').forEach((el) => el.classList.remove('is-active'));
        setScanImage(state.uploadedImage, '업로드한 음식 사진');
        if (hint) hint.textContent = file.name + ' · ' + Math.round(file.size / 1024) + 'KB — 브라우저 안에서만 처리됩니다';
        toast('사진이 준비되었습니다. 분석 시작을 눌러주세요.');
      };
      reader.readAsDataURL(file);
    };

    input.addEventListener('change', () => handle(input.files && input.files[0]));

    if (zone) {
      ['dragenter', 'dragover'].forEach((ev) =>
        zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('is-over'); }));
      ['dragleave', 'drop'].forEach((ev) =>
        zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('is-over'); }));
      zone.addEventListener('drop', (e) => {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        handle(f);
      });
    }
  }

  /* ============================================================
     대전 저칼로리 맛집 (네이버 지도 딥링크)
     ============================================================ */
  const KCAL_LIMIT = 600;
  let spotDistrict = 'all';

  function kcalBand(kcal) {
    if (kcal <= 350) return 'band-low';
    if (kcal <= 500) return 'band-mid';
    return 'band-high';
  }

  function renderSpotFilters() {
    const box = $('#spot-filter');
    if (!box) return;
    const districts = ['all'].concat(
      Array.from(new Set(window.DAEJEON_SPOTS.map((s) => s.district)))
    );
    box.innerHTML = districts.map((d) => {
      const label = d === 'all' ? '대전 전체' : d;
      const active = d === spotDistrict;
      return '<button type="button" class="seg' + (active ? ' is-active' : '') + '" ' +
        'data-value="' + d + '" role="radio" aria-checked="' + (active ? 'true' : 'false') + '">' +
        label + '</button>';
    }).join('');
  }

  function renderSpots() {
    const grid = $('#spot-grid');
    if (!grid) return;

    const all = window.DAEJEON_SPOTS || [];
    const rows = all
      .filter((s) => spotDistrict === 'all' || s.district === spotDistrict)
      .filter((s) => s.kcal <= KCAL_LIMIT)
      .sort((a, b) => a.kcal - b.kcal);

    const countEl = $('#spot-count');
    if (countEl) {
      countEl.innerHTML = '<b>' + rows.length + '</b>곳 · ' + KCAL_LIMIT + 'kcal 이하';
    }

    if (!rows.length) {
      grid.innerHTML = '<p class="list-empty">조건에 맞는 추천이 없습니다. 다른 지역을 선택해 보세요.</p>';
      return;
    }

    grid.innerHTML = rows.map((s) => {
      const w = clamp((s.kcal / KCAL_LIMIT) * 100, 6, 100);
      const url = window.naverMapSearchUrl(s.keyword);
      return '<article class="spot-card">' +
        '<header class="spot-head">' +
          '<span class="spot-emoji" aria-hidden="true">' + s.emoji + '</span>' +
          '<span class="spot-headtext">' +
            '<span class="spot-area">' +
              '<i class="fa-solid fa-location-dot" aria-hidden="true"></i>' + escapeHtml(s.district) +
            '</span>' +
            '<span class="spot-menu">' + escapeHtml(s.menu) + '</span>' +
            '<span class="spot-street">' + escapeHtml(s.area) + '</span>' +
          '</span>' +
        '</header>' +

        '<div class="spot-kcalrow">' +
          '<span class="spot-kcal">' + fmt(s.kcal) + '<small>kcal</small></span>' +
          '<span class="spot-macros">탄 <b>' + fmt(s.carbs) + '</b> · 단 <b>' + fmt(s.protein) +
            '</b> · 지 <b>' + fmt(s.fat) + '</b></span>' +
        '</div>' +

        '<div class="kcal-scale"><span class="' + kcalBand(s.kcal) + '" style="width:' + Math.round(w) + '%"></span></div>' +

        '<p class="spot-note"><i class="fa-solid fa-lightbulb" aria-hidden="true"></i>' +
          escapeHtml(s.note) + '</p>' +

        '<div class="spot-tags">' + s.tags.map((t) => '<span>' + escapeHtml(t) + '</span>').join('') + '</div>' +

        '<div class="spot-actions">' +
          '<a class="btn btn-map" href="' + url + '" target="_blank" rel="noopener noreferrer">' +
            '<i class="fa-solid fa-map-location-dot" aria-hidden="true"></i> 네이버 지도' +
          '</a>' +
          '<button class="btn btn-outline" type="button" data-spot="' + s.id + '">' +
            '<i class="fa-solid fa-plus" aria-hidden="true"></i> 식단 기록' +
          '</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  async function logSpot(id) {
    const s = (window.DAEJEON_SPOTS || []).find((x) => x.id === id);
    if (!s) return;
    const now = new Date();
    await addMeal({
      id: uid(),
      food_id: s.id,
      name: s.menu + ' (' + s.area.split(' · ')[0] + ')',
      emoji: s.emoji,
      image: '',
      kcal: s.kcal,
      carbs: s.carbs,
      protein: s.protein,
      fat: s.fat,
      meal_time: slotFromHour(now.getHours()),
      day: dayKey(now),
      logged_at: clockKey(now),
      allergens: '',
      source: 'user'
    });
    renderDashboard();
    toast(s.menu + ' ' + fmt(s.kcal) + ' kcal 기록');
  }

  function bindSpots() {
    renderSpotFilters();
    renderSpots();

    const box = $('#spot-filter');
    if (box) {
      box.addEventListener('click', (e) => {
        const btn = e.target.closest('.seg');
        if (!btn) return;
        spotDistrict = btn.dataset.value;
        $$('.seg', box).forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-checked', active ? 'true' : 'false');
        });
        renderSpots();
      });
    }

    const grid = $('#spot-grid');
    if (grid) {
      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-spot]');
        if (btn) logSpot(btn.dataset.spot);
      });
    }
  }

  /* ============================================================
     내비게이션 / 스크롤 / 카운터
     ============================================================ */
  function bindNav() {
    const toggle = $('#nav-toggle');
    const nav = $('#site-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $$('a', nav).forEach((a) => a.addEventListener('click', () => {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }));
    }

    const header = $('#site-header');
    const onScroll = () => { if (header) header.classList.toggle('is-stuck', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // 현재 섹션 표시
    const links = $$('#site-nav a');
    const sections = links
      .map((a) => document.querySelector(a.getAttribute('href')))
      .filter(Boolean);
    if ('IntersectionObserver' in window && sections.length) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + en.target.id));
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      sections.forEach((s) => io.observe(s));
    }

    // 등장 애니메이션
    const reveals = $$('.reveal');
    if ('IntersectionObserver' in window && reveals.length) {
      const ro = new IntersectionObserver((entries, obs) => {
        entries.forEach((en, i) => {
          if (!en.isIntersecting) return;
          setTimeout(() => en.target.classList.add('is-visible'), i * 90);
          obs.unobserve(en.target);
        });
      }, { threshold: 0.15 });
      reveals.forEach((el) => ro.observe(el));
    } else {
      reveals.forEach((el) => el.classList.add('is-visible'));
    }
  }

  function animateCounters() {
    $$('[data-count]').forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const dur = 1200;
      const start = performance.now();
      const step = (now) => {
        const p = clamp((now - start) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(decimals);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = target.toFixed(decimals);
      };
      requestAnimationFrame(step);
    });
  }

  function renderToday() {
    const el = $('#today-pill');
    if (!el) return;
    const d = new Date();
    el.textContent = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  }

  /* ============================================================
     초기화
     ============================================================ */
  async function init() {
    renderToday();
    renderFoodPicker();
    bindUpload();
    bindNav();
    bindGoalForm();
    bindBurnControls();
    bindSpots();
    animateCounters();

    const analyzeBtn = $('#analyze-btn');
    if (analyzeBtn) analyzeBtn.addEventListener('click', runAnalysis);
    const reBtn = $('#reanalyze-btn');
    if (reBtn) reBtn.addEventListener('click', () => { resetScanImage(); runAnalysis(); });

    const demoBtn = $('#load-demo-btn');
    if (demoBtn) demoBtn.addEventListener('click', async () => {
      demoBtn.disabled = true;
      await loadDemo();
      demoBtn.disabled = false;
    });

    const clearBtn = $('#clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', async () => {
      if (!state.meals.length) { toast('삭제할 기록이 없습니다.', 'warn'); return; }
      clearBtn.disabled = true;
      await clearMeals();
      renderDashboard();
      clearBtn.disabled = false;
      toast('모든 식사 기록을 삭제했습니다.');
    });

    const list = $('#meal-list');
    if (list) list.addEventListener('click', async (e) => {
      const btn = e.target.closest('.meal-del');
      if (!btn) return;
      await removeMeal(btn.dataset.id);
      renderDashboard();
      toast('기록을 삭제했습니다.');
    });

    // 기본 선택: 첫 번째 음식
    selectFood(window.FOOD_DB[0].id);

    loadGoal();
    await loadMeals();
    renderDashboard();

    if (state.storage === 'local' && state.meals.length === 0) {
      setStorageUI('local');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
