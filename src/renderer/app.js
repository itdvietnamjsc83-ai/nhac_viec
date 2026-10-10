const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const toLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const DAY = 86400000;
const DONE = 'Hoàn thành';
const STATUSES = ['Chưa bắt đầu', 'Đang thực hiện', 'Tạm dừng', DONE];
const STATUS_ICON = { 'Chưa bắt đầu': '⚪', 'Đang thực hiện': '🔵', 'Tạm dừng': '🟡', 'Hoàn thành': '🟢' };
const PRI = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
const PRI_RANK = { high: 0, medium: 1, low: 2, '': 3 };
const PALETTE = ['#3366ff', '#12b76a', '#f79009', '#ee46bc', '#7a5af8', '#06aed4', '#f04438', '#669f2a'];
const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const VIEW_TITLES = { today: 'Hôm nay', upcoming: '7 ngày tới', overdue: 'Quá hạn', queue: 'Hàng đợi nhắc việc', all: 'Tất cả công việc', done: 'Đã hoàn thành' };

let tasks = [];
let state = { view: 'today', project: null, q: '', mode: 'list', calMonth: null, showDone: false };
try { Object.assign(state, JSON.parse(localStorage.getItem('ui') || '{}'), { q: '', calMonth: null }); } catch {}
const saveUi = () => { try { localStorage.setItem('ui', JSON.stringify({ view: state.view, project: state.project, mode: state.mode })); } catch {} };

// ---------- Tiện ích ngày giờ ----------
const sod = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayDiff = d => Math.round((sod(d) - sod()) / DAY);
function fmtDate(s, withTime = false) {
  if (!s) return '';
  const d = new Date(s), diff = dayDiff(d);
  let label = diff === 0 ? 'Hôm nay' : diff === 1 ? 'Ngày mai' : diff === -1 ? 'Hôm qua'
    : (diff > 1 && diff < 7) ? WEEKDAY[d.getDay()] : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}${d.getFullYear() !== new Date().getFullYear() ? '/' + d.getFullYear() : ''}`;
  if (withTime && String(s).length > 10) label += ` ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return label;
}
function lunarStr(d) {
  const l = Lunar.solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
  return `${l.day}/${l.month}${l.leap ? ' nhuận' : ''} năm ${Lunar.yearName(l.year)}`;
}

const isDone = t => t.status === DONE;
const isOverdue = t => !isDone(t) && t.deadline && new Date(t.deadline) < new Date();
const isToday = t => !isDone(t) && [t.deadline, t.remindAt].some(s => s && dayDiff(new Date(s)) === 0);
const inQueue = t => !isDone(t) && (t.alerting || (t.remindAt && !t.notified));
const isUpcoming = t => !isDone(t) && t.deadline && new Date(t.deadline) >= new Date() && dayDiff(new Date(t.deadline)) < 7;
const projectColor = p => { let h = 0; for (const c of p || '') h = (h * 31 + c.charCodeAt(0)) >>> 0; return p ? PALETTE[h % PALETTE.length] : '#9aa1b2'; };
const projects = () => [...new Set(tasks.map(t => t.project).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));

function filtered(ignoreView = false) {
  const q = state.q.trim().toLowerCase();
  return tasks.filter(t => {
    if (state.project !== null && (t.project || '') !== state.project) return false;
    if (!ignoreView && state.project === null) {
      if (state.view === 'today' && !(isToday(t) || isOverdue(t))) return false;
      if (state.view === 'overdue' && !isOverdue(t)) return false;
      if (state.view === 'upcoming' && !isUpcoming(t)) return false;
      if (state.view === 'done' && !isDone(t)) return false;
      if (state.view === 'queue' && !inQueue(t)) return false;
    }
    if (q && ![t.title, t.project, t.owner, t.note].some(x => (x || '').toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || PRI_RANK[a.priority || ''] - PRI_RANK[b.priority || '']);
}

// ---------- Vẽ giao diện ----------
function renderSidebar() {
  $('#c-today').textContent = tasks.filter(t => isToday(t) || isOverdue(t)).length || '';
  $('#c-upcoming').textContent = tasks.filter(isUpcoming).length || '';
  $('#c-overdue').textContent = tasks.filter(isOverdue).length || '';
  $('#c-queue').textContent = tasks.filter(inQueue).length || '';
  $('#c-all').textContent = tasks.filter(t => !isDone(t)).length || '';
  $('#c-done').textContent = tasks.filter(isDone).length || '';
  $$('#views button').forEach(b => b.classList.toggle('active', state.project === null && b.dataset.view === state.view));

  const names = projects();
  $('#projects').innerHTML = names.map(p => {
    const list = tasks.filter(t => t.project === p);
    const avg = Math.round(list.reduce((s, t) => s + (t.progress || 0), 0) / list.length);
    const c = projectColor(p);
    return `<button data-project="${esc(p)}" class="${state.project === p ? 'active' : ''}">
      <span class="dot" style="background:${c}"></span><span class="pname">${esc(p)}</span><span class="count">${avg}%</span>
      <span class="mini"><i style="width:${avg}%;background:${c}"></i></span></button>`;
  }).join('') || '<div class="empty-proj">Chưa có dự án. Gõ #Tên_dự_án khi thêm việc, hoặc nhập từ Excel.</div>';
  $('#projectList').innerHTML = names.map(p => `<option value="${esc(p)}">`).join('');
}

function renderHeader() {
  const now = new Date(), h = now.getHours();
  const hello = h < 11 ? 'Chào buổi sáng' : h < 13 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  $('#greet').textContent = `${hello} 👋 · ${WEEKDAY[now.getDay()]}, ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} · Âm lịch ${lunarStr(now)}`;
  $('#viewTitle').textContent = state.project !== null ? state.project : VIEW_TITLES[state.view];
  $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === state.mode));
}

function ringSvg(pct, color) {
  const r = 18, c = 2 * Math.PI * r;
  return `<svg width="46" height="46" viewBox="0 0 46 46"><circle cx="23" cy="23" r="${r}" fill="none" stroke="var(--line)" stroke-width="5"/>
    <circle cx="23" cy="23" r="${r}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="${pct ? 'round' : 'butt'}" stroke-dasharray="${c * pct / 100} ${c}" transform="rotate(-90 23 23)" style="transition:stroke-dasharray .6s"/></svg>`;
}

function renderSummary() {
  const box = $('#summary');
  let list, html;
  if (state.project !== null) {
    list = tasks.filter(t => t.project === state.project);
    const avg = list.length ? Math.round(list.reduce((s, t) => s + (t.progress || 0), 0) / list.length) : 0;
    const last = list.map(t => t.deadline).filter(Boolean).sort().pop();
    html = `<div class="stat ring">${ringSvg(avg, projectColor(state.project))}<div><b>${avg}%</b><span>Tiến độ dự án</span></div></div>
      <div class="stat green"><b>${list.filter(isDone).length}/${list.length}</b><span>Việc đã xong</span></div>
      <div class="stat ${list.some(isOverdue) ? 'red' : ''}"><b>${list.filter(isOverdue).length}</b><span>Việc quá hạn</span></div>
      <div class="stat blue"><b>${last ? new Date(last).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</b><span>Hạn cuối dự án</span></div>`;
  } else if (state.view === 'today') {
    const todayAll = tasks.filter(t => [t.deadline, t.remindAt].some(s => s && dayDiff(new Date(s)) === 0));
    const done = todayAll.filter(isDone).length;
    const pct = todayAll.length ? Math.round(done / todayAll.length * 100) : 0;
    html = `<div class="stat ring">${ringSvg(pct, 'var(--green)')}<div><b>${done}/${todayAll.length}</b><span>Việc hôm nay đã xong</span></div></div>
      <div class="stat ${tasks.some(isOverdue) ? 'red' : ''}"><b>${tasks.filter(isOverdue).length}</b><span>Quá hạn</span></div>
      <div class="stat blue"><b>${tasks.filter(isUpcoming).length}</b><span>Đến hạn trong 7 ngày</span></div>`;
  }
  box.innerHTML = html || '';
  box.classList.toggle('hidden', !html || state.mode === 'calendar' || state.mode === 'timeline');
}

function fmtFull(s) {
  if (!s) return '';
  const d = new Date(s);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
// Đúng hạn / trễ bao lâu, so giờ hoàn thành với hạn
function doneVerdict(t) {
  if (!t.completedAt || !t.deadline) return '';
  const diff = new Date(t.completedAt) - new Date(t.deadline);
  if (diff <= 0) return '<span class="ok-tag">đúng hạn</span>';
  const h = Math.round(diff / 3600000);
  return `<span class="late-tag">trễ ${h >= 24 ? Math.round(h / 24) + ' ngày' : Math.max(1, h) + ' giờ'}</span>`;
}

function metaHtml(t, compact = false) {
  const m = [];
  if (isDone(t) && t.completedAt) m.push(`<span>✅ Xong lúc ${fmtFull(t.completedAt)} ${doneVerdict(t)}</span>`);
  if (t.priority && !isDone(t)) m.push(`<span class="ptag p-${t.priority}">● ${PRI[t.priority]}</span>`);
  if (t.deadline) {
    const cls = isOverdue(t) ? 'late' : (!isDone(t) && dayDiff(new Date(t.deadline)) <= 1 ? 'soon' : '');
    const lateH = (Date.now() - new Date(t.deadline)) / 3600000;
    const late = isOverdue(t) ? ` (trễ ${lateH < 24 ? Math.max(1, Math.round(lateH)) + ' giờ' : Math.round(lateH / 24) + ' ngày'})` : '';
    m.push(`<span class="${cls}">📅 ${fmtDate(t.deadline, true)}${late}</span>`);
  }
  if (t.remindAt && !isDone(t) && !compact && state.view !== 'queue') m.push(`<span>⏰ ${fmtDate(t.remindAt, true)}${t.repeat && t.repeat !== 'none' ? ' 🔁' : ''}</span>`);
  if (t.snoozeCount && !isDone(t)) m.push(`<span class="snz">⏱ đã hoãn ${t.snoozeCount} lần</span>`);
  if (t.project && state.project === null && !compact) m.push(`<span><span class="dot" style="background:${projectColor(t.project)}"></span> ${esc(t.project)}</span>`);
  if (t.owner) m.push(`<span>👤 ${esc(t.owner)}</span>`);
  if (t.checklist?.length) m.push(`<span>☑️ ${t.checklist.filter(c => c.done).length}/${t.checklist.length}</span>`);
  if (t.progress > 0 && !isDone(t)) m.push(`<span><span class="tprog"><i style="width:${t.progress}%"></i></span>${t.progress}%</span>`);
  if (!compact && t.status !== 'Chưa bắt đầu' && !isDone(t)) m.push(`<span class="pill s-${STATUSES.indexOf(t.status)}">${esc(t.status)}</span>`);
  return m.join('');
}

function taskRow(t) {
  return `<div class="task ${isDone(t) ? 'done' : ''}" data-id="${t.id}">
    <button class="tick ${isDone(t) ? 'on' : 'p-' + (t.priority || 'none')}" title="Đánh dấu hoàn thành"></button>
    <div class="task-body"><div class="task-title">${esc(t.title)}</div><div class="meta">${metaHtml(t)}</div></div>
  </div>`;
}

function emptyHtml() {
  if (!tasks.length) return `<div class="empty"><div class="big">🗒️</div><h3>Bắt đầu thôi!</h3>
    <p>Gõ việc cần làm vào ô phía trên rồi bấm Enter,<br>hoặc <a data-x="import">nhập tiến độ dự án từ Excel</a> (theo <a data-x="template">file mẫu</a>).</p></div>`;
  if (state.view === 'today' && state.project === null) return `<div class="empty"><div class="big">🌤️</div><h3>Hôm nay thật nhẹ nhàng</h3><p>Không có việc nào đến hạn hoặc quá hạn.</p></div>`;
  return `<div class="empty"><div class="big">🔍</div><h3>Không có việc nào ở đây</h3></div>`;
}

function renderList() {
  const list = filtered();
  if (!list.length) return emptyHtml();
  if (state.view === 'done' && state.project === null) return renderDoneList(list);
  if (state.view === 'queue' && state.project === null) return renderQueue(list);
  const groups = [
    ['Quá hạn', list.filter(isOverdue), 'red'],
    ['Hôm nay', list.filter(t => !isOverdue(t) && isToday(t))],
    ['Sắp tới', list.filter(t => !isDone(t) && !isOverdue(t) && !isToday(t) && t.deadline)],
    ['Chưa đặt hạn', list.filter(t => !isDone(t) && !isOverdue(t) && !isToday(t) && !t.deadline)]
  ];
  let html = groups.filter(g => g[1].length).map(([name, items, cls]) =>
    `<div class="group"><div class="group-h ${cls || ''}">${name} <span class="n">${items.length}</span></div>${items.map(taskRow).join('')}</div>`).join('');
  const done = list.filter(isDone);
  if (done.length) html += `<div class="group"><div class="group-h toggle" id="toggleDone">${state.showDone ? '▾' : '▸'} Đã xong <span class="n">${done.length}</span></div>${state.showDone ? done.map(taskRow).join('') : ''}</div>`;
  return html;
}

// Việc đã xong, gom theo ngày hoàn thành, mới nhất lên đầu
function renderDoneList(list) {
  list = [...list].sort((a, b) => (b.completedAt || b.updatedAt || '').localeCompare(a.completedAt || a.updatedAt || ''));
  const groups = new Map();
  for (const t of list) {
    const k = t.completedAt ? t.completedAt.slice(0, 10) : '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const onTime = list.filter(t => t.completedAt && t.deadline && new Date(t.completedAt) <= new Date(t.deadline)).length;
  const withDl = list.filter(t => t.completedAt && t.deadline).length;
  let html = withDl ? `<div class="summary"><div class="stat green"><b>${list.length}</b><span>Việc đã hoàn thành</span></div>
    <div class="stat blue"><b>${Math.round(onTime / withDl * 100)}%</b><span>Xong đúng hạn (${onTime}/${withDl})</span></div></div>` : '';
  for (const [k, items] of groups) {
    const label = k ? (() => { const d = new Date(k + 'T00:00'); const n = dayDiff(d); return n === 0 ? 'Hôm nay' : n === -1 ? 'Hôm qua' : `${WEEKDAY[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; })() : 'Không rõ ngày';
    html += `<div class="group"><div class="group-h">Hoàn thành ${label.toLowerCase().startsWith('thứ') || label.startsWith('Chủ') ? label : label.toLowerCase()} <span class="n">${items.length}</span></div>${items.map(taskRow).join('')}</div>`;
  }
  return html;
}

// Hàng đợi: đang báo, đã hoãn, sắp nhắc (theo thứ tự giờ nhắc)
function renderQueue(list) {
  const byTime = (a, b) => (a.remindAt || '').localeCompare(b.remindAt || '');
  const groups = [
    ['🔔 Đang báo, chờ bạn xử lý', list.filter(t => t.alerting).sort(byTime), 'red'],
    ['⏱ Đã hoãn, sẽ nhắc lại', list.filter(t => !t.alerting && t.snoozeCount).sort(byTime)],
    ['⏰ Sắp đến giờ nhắc', list.filter(t => !t.alerting && !t.snoozeCount).sort(byTime)]
  ];
  return groups.filter(g => g[1].length).map(([name, items, cls]) =>
    `<div class="group"><div class="group-h ${cls || ''}">${name} <span class="n">${items.length}</span></div>${items.map(t => {
      const left = t.remindAt && !t.alerting ? ` · còn ${countdown(t.remindAt)}` : '';
      return taskRow(t).replace('<div class="meta">', `<div class="meta"><span>⏰ nhắc ${fmtDate(t.remindAt, true)}${left}</span>`);
    }).join('')}</div>`).join('');
}
function countdown(s) {
  const min = Math.max(0, Math.round((new Date(s) - Date.now()) / 60000));
  if (min < 60) return `${min} phút`;
  if (min < 1440) return `${Math.floor(min / 60)} giờ ${min % 60 ? (min % 60) + ' phút' : ''}`.trim();
  return `${Math.round(min / 1440)} ngày`;
}

function renderBoard() {
  const list = filtered(true).filter(t => state.project !== null || state.view !== 'done' || isDone(t));
  return `<div class="board">${STATUSES.map(s => {
    const items = list.filter(t => t.status === s).sort((a, b) => PRI_RANK[a.priority || ''] - PRI_RANK[b.priority || ''] || (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    return `<div class="col" data-status="${s}"><div class="col-h">${STATUS_ICON[s]} ${s}<span class="count">${items.length}</span></div>
      ${items.map(t => `<div class="card p-${t.priority || 'none'}" draggable="true" data-id="${t.id}">
        <div class="task-title">${esc(t.title)}</div><div class="meta">${metaHtml(t, true)}${t.project && state.project === null ? `<span><span class="dot" style="background:${projectColor(t.project)}"></span> ${esc(t.project)}</span>` : ''}</div></div>`).join('')}
      <button class="col-add" data-status="${s}">＋ Thêm việc</button></div>`;
  }).join('')}</div>`;
}

function renderCalendar() {
  const now = new Date();
  const m = state.calMonth || new Date(now.getFullYear(), now.getMonth(), 1);
  const first = new Date(m.getFullYear(), m.getMonth(), 1);
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const list = filtered(true);
  const byDay = {};
  for (const t of list) {
    const s = t.deadline || t.remindAt; if (!s) continue;
    const k = toLocal(new Date(s)).slice(0, 10);
    (byDay[k] = byDay[k] || []).push(t);
  }
  const midLunar = Lunar.solarToLunar(15, m.getMonth() + 1, m.getFullYear());
  let html = `<div class="cal-head"><h2>Tháng ${m.getMonth() + 1}/${m.getFullYear()}</h2>
    <button class="soft" data-cal="-1">‹</button><button class="soft" data-cal="0">Hôm nay</button><button class="soft" data-cal="1">›</button>
    <span class="spacer"></span><span class="lunar-y">Năm ${Lunar.yearName(midLunar.year)} · số nhỏ là ngày âm lịch</span></div><div class="cal">`;
  html += ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'].map(w => `<div class="wd">${w}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (i === 35 && d.getMonth() !== m.getMonth()) break;
    const l = Lunar.solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
    const k = toLocal(d).slice(0, 10);
    const evs = (byDay[k] || []).sort((a, b) => isDone(a) - isDone(b) || PRI_RANK[a.priority || ''] - PRI_RANK[b.priority || '']);
    const hol = Lunar.holiday(d);
    html += `<div class="day ${d.getMonth() !== m.getMonth() ? 'other' : ''} ${dayDiff(d) === 0 ? 'today' : ''}" data-date="${k}">
      <div class="day-n"><b>${d.getDate()}</b><span class="al ${l.day === 1 || l.day === 15 ? 'm1' : ''}">${l.day === 1 ? `1/${l.month}${l.leap ? 'N' : ''}` : l.day}</span></div>
      ${hol ? `<div class="hol">${hol}</div>` : ''}
      ${evs.slice(0, 3).map(t => `<div class="ev p-${t.priority || 'none'} ${isDone(t) ? 'done' : ''}" data-id="${t.id}" title="${esc(t.title)}">${esc(t.title)}</div>`).join('')}
      ${evs.length > 3 ? `<div class="ev-more">+${evs.length - 3} việc nữa</div>` : ''}</div>`;
  }
  return html + '</div>';
}

function renderTimeline() {
  const list = filtered(true).filter(t => t.start || t.deadline);
  if (!list.length) return `<div class="empty"><div class="big">📈</div><h3>Chưa có việc nào có ngày bắt đầu hoặc hạn</h3><p>Biểu đồ tiến độ dùng cột "Ngày bắt đầu" và "Hạn hoàn thành".</p></div>`;
  const span = t => {
    const e = sod(new Date(t.deadline || t.start));
    const s = t.start ? sod(new Date(t.start)) : new Date(+e - 2 * DAY);
    return [s <= e ? s : e, e];
  };
  let min = Infinity, max = -Infinity;
  for (const t of list) { const [s, e] = span(t); min = Math.min(min, +s); max = Math.max(max, +e); }
  min = Math.min(min, +sod()) - 2 * DAY; max = Math.max(max, +sod()) + 3 * DAY;
  const days = Math.round((max - min) / DAY);
  const avail = Math.max(400, $('#content').clientWidth - 250);
  const W = Math.max(8, Math.min(40, Math.floor(avail / days)));
  const width = days * W;
  const x = d => Math.round((+sod(d) - min) / DAY) * W;
  const step = Math.ceil(44 / W);
  let ticks = '';
  for (let i = 0; i < days; i += step) { const d = new Date(min + i * DAY); ticks += `<div class="tl-tick" style="left:${i * W}px">${d.getDate()}/${d.getMonth() + 1}</div>`; }
  const today = `<div class="tl-today" style="left:${x(new Date()) + W / 2}px" title="Hôm nay"></div>`;
  const groups = {};
  for (const t of list) (groups[t.project || 'Việc lẻ'] = groups[t.project || 'Việc lẻ'] || []).push(t);
  let rows = `<div class="tl-row tl-head"><div class="tl-name"></div><div class="tl-track" style="width:${width}px">${ticks}${today}</div></div>`;
  for (const [p, items] of Object.entries(groups)) {
    if (state.project === null) rows += `<div class="tl-row"><div class="tl-name proj"><span class="dot" style="background:${projectColor(p === 'Việc lẻ' ? '' : p)}"></span> ${esc(p)}</div><div class="tl-track" style="width:${width}px;height:26px">${today}</div></div>`;
    for (const t of items.sort((a, b) => +span(a)[0] - +span(b)[0])) {
      const [s, e] = span(t);
      const cls = isDone(t) ? 'done' : isOverdue(t) ? 'late' : '';
      rows += `<div class="tl-row" data-id="${t.id}"><div class="tl-name" title="${esc(t.title)}">${esc(t.title)}</div>
        <div class="tl-track" style="width:${width}px">${today}
        <div class="tl-bar ${cls}" data-id="${t.id}" style="left:${x(s)}px;width:${x(e) - x(s) + W}px" title="${esc(t.title)} · ${fmtDate(t.start) || '?'} → ${fmtDate(t.deadline) || '?'} · ${t.progress || 0}%">
        <i style="width:${t.progress || 0}%"></i><span>${t.progress || 0}%</span></div></div></div>`;
    }
  }
  return `<div class="tl">${rows}</div>`;
}

function renderAlerts() {
  const alerting = tasks.filter(t => t.alerting && !isDone(t));
  const box = $('#alerts');
  box.classList.toggle('hidden', !alerting.length);
  box.innerHTML = alerting.length ? `<h3><span class="bell">🔔</span> Đến giờ nhắc (${alerting.length})</h3>` + alerting.map(t => `
    <div class="alert-item" data-id="${t.id}">
      <span class="t"><b>${esc(t.title)}</b> <span class="muted">${t.deadline ? '· hạn ' + fmtDate(t.deadline, true) : ''}</span></span>
      <span class="more"><button data-m="5">+5′</button><button data-m="15">+15′</button><button data-m="30">+30′</button><button data-m="60">+1 giờ</button><button data-m="tomorrow">Mai 8:00</button></span>
      <button data-a="done">✓ Xong</button><button data-a="dismiss">Đã xem</button>
    </div>`).join('') : '';
}

function render() {
  renderSidebar(); renderHeader(); renderAlerts(); renderSummary();
  const fn = { list: renderList, board: renderBoard, calendar: renderCalendar, timeline: renderTimeline }[state.mode] || renderList;
  $('#content').innerHTML = fn();
}

async function reload() { tasks = await api.list(); render(); }

// ---------- Thông báo nhỏ, hiệu ứng ----------
function toast(msg, action) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  el.classList.remove('hidden');
  if (action) el.querySelector('button').onclick = () => { el.classList.add('hidden'); action.fn(); };
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add('hidden'), action ? 6000 : 4000);
}
function confetti(el) {
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    const a = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 40;
    c.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;background:${PALETTE[i % PALETTE.length]};--dx:${Math.cos(a) * dist}px;--dy:${Math.sin(a) * dist}px`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 800);
  }
}

async function setDone(t, done, el) {
  const before = { status: t.status, progress: t.progress, checklist: t.checklist, completedAt: t.completedAt || null };
  const patch = done
    ? { id: t.id, status: DONE, progress: 100, alerting: false }
    : { id: t.id, status: t.progress > 0 && t.progress < 100 ? 'Đang thực hiện' : 'Chưa bắt đầu', progress: t.progress === 100 ? 0 : t.progress };
  if (done && el) {
    el.classList.add('on'); confetti(el);
    el.closest('.task')?.classList.add('leaving');
    await new Promise(r => setTimeout(r, 380));
  }
  await api.save(patch);
  if (done) toast(`🎉 Đã xong "${t.title}" lúc ${fmtFull(toLocal(new Date())).slice(0, 5)}`, { label: 'Hoàn tác', fn: () => api.save({ id: t.id, ...before }) });
}

// ---------- Hộp thoại chi tiết ----------
const form = $('#form');
const f = n => form.elements[n];
let editing = null, checklist = [], picked = { priority: '', status: 'Chưa bắt đầu' };

function toggleDoneField() {
  const on = picked.status === DONE;
  $('#doneField').classList.toggle('hidden', !on);
  if (on && !f('completedAt').value) f('completedAt').value = toLocal(new Date());
  if (!on) f('completedAt').value = '';
}
function pick(group, v) {
  picked[group] = v;
  if (group === 'status' && $('#doneField')) toggleDoneField();
  $$(`#pick${group === 'priority' ? 'Priority' : 'Status'} button`).forEach(b => b.classList.toggle('on', b.dataset.v === v));
}
function renderChecklist() {
  $('#checklist').innerHTML = checklist.map((c, i) => `<div class="cl ${c.done ? 'ok' : ''}" data-i="${i}">
    <input type="checkbox" ${c.done ? 'checked' : ''}><input type="text" value="${esc(c.text)}"><button type="button" class="x" title="Xóa bước">✕</button></div>`).join('');
  const n = checklist.filter(c => c.done).length;
  $('#clCount').textContent = checklist.length ? `${n}/${checklist.length}` : '';
}
function syncProgressFromChecklist() {
  if (!checklist.length) return;
  const p = Math.round(checklist.filter(c => c.done).length / checklist.length * 100);
  f('progress').value = p; $('#progOut').textContent = p + '%';
  if (p === 100) pick('status', DONE);
  else if (p > 0 && (picked.status === 'Chưa bắt đầu' || picked.status === DONE)) pick('status', 'Đang thực hiện');
  else if (p === 0 && picked.status === DONE) pick('status', 'Chưa bắt đầu');
}

function openForm(t, preset = {}) {
  editing = t || null;
  form.reset();
  const v = t || { project: state.project || '', status: 'Chưa bắt đầu', progress: 0, repeat: 'none', priority: '', ...preset };
  for (const name of ['title', 'project', 'owner', 'start', 'deadline', 'remindManual', 'remindBefore', 'repeat', 'progress', 'note', 'completedAt']) f(name).value = v[name] ?? '';
  if (!f('repeat').value) f('repeat').value = 'none';
  pick('priority', v.priority || ''); pick('status', v.status || 'Chưa bắt đầu');
  checklist = (v.checklist || []).map(c => ({ ...c }));
  renderChecklist();
  $('#progOut').textContent = (v.progress || 0) + '%';
  $('#btnDelete').classList.toggle('hidden', !t);
  const H = { snooze: 'Hoãn nhắc đến', done: 'Đánh dấu hoàn thành', reopen: 'Mở lại việc' };
  $('#history').innerHTML = (v.history || []).slice(-6).reverse().map(h => `• ${fmtFull(h.at)}: ${H[h.action] || h.action}${h.value ? ' ' + fmtFull(h.value) : ''}`).join('<br>');
  if ($('#history').innerHTML) $('#history').insertAdjacentHTML('afterbegin', '<b>Lịch sử</b><br>');
  toggleDoneField(); renderRemindPreview();
  $('#dlg').showModal();
  setTimeout(() => f('title').focus(), 50);
}

$('#pickPriority').addEventListener('click', e => { const b = e.target.closest('button'); if (b) pick('priority', b.dataset.v); });
$('#pickStatus').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  pick('status', b.dataset.v);
  if (b.dataset.v === DONE) { f('progress').value = 100; $('#progOut').textContent = '100%'; }
});
f('progress').addEventListener('input', () => {
  const p = +f('progress').value; $('#progOut').textContent = p + '%';
  if (p === 100) pick('status', DONE);
  else if (p > 0 && (picked.status === 'Chưa bắt đầu' || picked.status === DONE)) pick('status', 'Đang thực hiện');
});
$('#clNew').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const text = e.target.value.trim(); if (!text) return;
  checklist.push({ id: Date.now().toString(36), text, done: false });
  e.target.value = ''; renderChecklist(); syncProgressFromChecklist();
});
$('#checklist').addEventListener('change', e => {
  const row = e.target.closest('.cl'); if (!row) return;
  const c = checklist[+row.dataset.i];
  if (e.target.type === 'checkbox') { c.done = e.target.checked; renderChecklist(); syncProgressFromChecklist(); }
  else c.text = e.target.value;
});
$('#checklist').addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
$('#checklist').addEventListener('click', e => {
  if (!e.target.classList.contains('x')) return;
  checklist.splice(+e.target.closest('.cl').dataset.i, 1); renderChecklist(); syncProgressFromChecklist();
});
$$('.quick-times button').forEach(b => b.addEventListener('click', () => {
  const q = b.dataset.q; let d;
  if (q === 'tomorrow') { d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); }
  else if (q === 'before') {
    if (!f('deadline').value) return toast('Hãy chọn hạn hoàn thành trước.');
    d = new Date(f('deadline').value); d.setDate(d.getDate() - 1);
  } else d = new Date(Date.now() + +q * 60000);
  f('remindManual').value = toLocal(d);
  renderRemindPreview();
}));

// ---------- Nhắc trước hạn: chip bật/tắt + xem trước các mốc ----------
function rbList() { return f('remindBefore').value.split(/,|;/).map(x => x.trim()).filter(Boolean); }
function renderRemindPreview() {
  const rules = Remind.parse(f('remindBefore').value);
  const mins = new Set(rules.filter(r => r.min).map(r => r.min));
  $$('#rbChips button').forEach(b => { const r = Remind.parse(b.dataset.rb)[0]; b.classList.toggle('on', mins.has(r.min)); });
  const task = { deadline: f('deadline').value || null, remindBefore: f('remindBefore').value, remindManual: f('remindManual').value || null };
  const pts = Remind.schedule(task);
  const box = $('#rbPreview');
  if (rules.length && !task.deadline) { box.innerHTML = '<span class="warn">Chọn hạn hoàn thành (có giờ) để tính mốc nhắc.</span>'; return; }
  if (f('remindBefore').value.trim() && !rules.length) { box.innerHTML = '<span class="warn">Chưa hiểu, hãy ghi như: 1 ngày, 2 giờ, 30 phút</span>'; return; }
  const now = toLocal(new Date());
  box.innerHTML = pts.length ? 'Sẽ nhắc: ' + pts.map(p => `<span class="chip ${p < now ? 'past' : ''}">🔔 ${fmtFull(p)}</span>`).join(' ') : '';
}
$('#rbChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const target = Remind.parse(b.dataset.rb)[0].min;
  const cur = rbList();
  const keep = cur.filter(x => { const r = Remind.parse(x); return !(r.length === 1 && r[0].min === target); });
  if (keep.length === cur.length) keep.push(b.dataset.rb);
  const sorted = keep.map(x => [x, (Remind.parse(x)[0] || {}).min ?? (Remind.parse(x)[0]?.days || 0) * 1440]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  f('remindBefore').value = sorted.join(', ');
  renderRemindPreview();
});
for (const n of ['remindBefore', 'deadline', 'remindManual']) f(n).addEventListener('input', renderRemindPreview);

$('#dlg').addEventListener('close', async () => {
  if ($('#dlg').returnValue !== 'ok') return;
  const data = { priority: picked.priority, status: picked.status, checklist: checklist.filter(c => c.text.trim()) };
  for (const name of ['title', 'project', 'owner', 'start', 'deadline', 'remindManual', 'repeat', 'note', 'completedAt']) data[name] = f(name).value.trim() || null;
  data.remindBefore = f('remindBefore').value.trim();
  data.progress = +f('progress').value;
  data.project = data.project || '';
  data.repeat = data.repeat || 'none';
  if (editing) data.id = editing.id;
  const wasDone = editing && isDone(editing);
  await api.save(data);
  toast(editing ? (!wasDone && data.status === DONE ? `🎉 Đã xong "${data.title}"` : 'Đã lưu thay đổi') : 'Đã thêm việc mới');
});
$('#btnDelete').addEventListener('click', async () => {
  if (!editing) return;
  const backup = { ...editing };
  await api.remove(editing.id);
  $('#dlg').close();
  toast(`Đã xóa "${backup.title}"`, { label: 'Hoàn tác', fn: () => api.save(backup) });
});

// ---------- Thêm nhanh ----------
function quickParse() { return QuickAdd.parse($('#quick').value, new Date(), projects()); }
function quickToTask(r) {
  const t = { title: r.title, priority: r.priority || '', project: r.project || state.project || '', owner: r.owner || '', repeat: r.repeat || 'none' };
  if (r.date) {
    const d = new Date(r.date);
    if (r.time) { d.setHours(r.time[0], r.time[1], 0, 0); t.deadline = toLocal(d); t.remindManual = toLocal(d); }
    else { d.setHours(17, 0, 0, 0); t.deadline = toLocal(d); const rm = new Date(d); rm.setHours(8, 0, 0, 0); t.remindManual = toLocal(rm); }
    if (r.before) { t.remindBefore = r.before; t.remindManual = null; }
  }
  return t;
}
$('#quick').addEventListener('input', () => {
  const v = $('#quick').value.trim();
  if (!v) { $('#quickPreview').innerHTML = ''; return; }
  const t = quickToTask(quickParse());
  const chips = [];
  if (t.deadline) chips.push(`📅 ${fmtDate(t.deadline, true)}`);
  if (t.remindManual && t.remindManual !== t.deadline) chips.push(`⏰ ${fmtDate(t.remindManual, true)}`);
  if (t.remindBefore) chips.push(`🔔 trước ${t.remindBefore}`);
  if (t.priority) chips.push({ cls: 'p-' + t.priority, text: `● ${PRI[t.priority]}` });
  if (t.project) chips.push(`📁 ${t.project}`);
  if (t.owner) chips.push(`👤 ${t.owner}`);
  if (t.repeat !== 'none') chips.push({ daily: '🔁 Hằng ngày', weekly: '🔁 Hằng tuần', monthly: '🔁 Hằng tháng' }[t.repeat]);
  $('#quickPreview').innerHTML = chips.map(c => `<span class="chip ${c.cls || ''}">${esc(c.text || c)}</span>`).join('');
});
$('#quick').addEventListener('keydown', async e => {
  if (e.key !== 'Enter') return;
  const r = quickParse(); if (!r.title) return;
  const t = quickToTask(r);
  await api.save(t);
  $('#quick').value = ''; $('#quickPreview').innerHTML = '';
  toast(`Đã thêm "${t.title}"${t.remindManual ? ' · nhắc ' + fmtDate(t.remindManual, true) : ''}`);
});
$('#btnAdd').addEventListener('click', () => {
  const v = $('#quick').value.trim();
  const preset = v ? quickToTask(quickParse()) : {};
  $('#quick').value = ''; $('#quickPreview').innerHTML = '';
  openForm(null, preset);
});

// ---------- Excel ----------
async function excel(action) {
  $('#excelMenu').classList.add('hidden');
  if (action === 'import') {
    const r = await api.importExcel(); if (!r) return;
    let msg = r.file ? `📊 Đã nhập "${r.file}": thêm ${r.added} việc, cập nhật ${r.updated} việc` : '';
    if (r.errors?.length) msg += (msg ? '\n' : '') + r.errors.slice(0, 4).join('\n') + (r.errors.length > 4 ? `\n… và ${r.errors.length - 4} lỗi khác` : '');
    if (r.added + r.updated > 0 && state.view === 'today' && state.project === null) { state.view = 'all'; saveUi(); render(); }
    toast(msg);
  } else if (action === 'template') {
    const p = await api.saveTemplate(); if (p) toast('Đã lưu file mẫu: ' + p);
  } else if (action === 'backup') {
    const r = await api.exportData(); if (r) toast(`📤 Đã xuất ${r.count} việc. Chép file này sang máy kia rồi chọn "Nhập dữ liệu từ máy khác".`);
  } else if (action === 'restore') {
    const r = await api.importData(); if (!r) return;
    if (r.error) return toast('⚠️ ' + r.error);
    $('#dlgSettings').open && $('#dlgSettings').close();
    toast(`📥 Đã nhập "${r.file}": thêm ${r.added}, cập nhật ${r.updated} việc. Tổng cộng ${r.total} việc.`);
  } else if (action === 'phone') {
    openPhone();
  } else if (action === 'export') {
    const ids = filtered(state.mode !== 'list').map(t => t.id);
    const p = await api.exportExcel(ids); if (p) toast(`Đã xuất ${ids.length} việc ra Excel`);
  }
}
// ---------- Đồng bộ sang điện thoại ----------
async function openPhone(newCode = false) {
  $('#dlgSettings').open && $('#dlgSettings').close();
  if (!$('#dlgPhone').open) $('#dlgPhone').showModal();
  $('#phStatus').className = 'ph-status';
  $('#phStatus').textContent = 'Đang mở cổng đồng bộ…';
  try {
    const r = await api.phoneStart({ newCode });
    if (!r.url) { $('#phQr').innerHTML = ''; $('#phStatus').textContent = '⚠️ Máy tính chưa kết nối Wi-Fi / mạng nội bộ. Hãy dùng cách xuất file.'; return; }
    $('#phQr').innerHTML = r.qr;
    $('#phAddr').textContent = `${r.ips[0]}:${r.port}`;
    $('#phAddr').title = r.ips.length > 1 ? 'Địa chỉ khác: ' + r.ips.slice(1).map(ip => `${ip}:${r.port}`).join(', ') : '';
    $('#phCode').textContent = r.code.replace(/(\d{3})(\d{3})/, '$1 $2');
    $('#phStatus').textContent = `Sẵn sàng gửi ${r.count} việc. Đang chờ điện thoại…`;
  } catch (e) { $('#phStatus').textContent = '⚠️ Không mở được cổng đồng bộ: ' + e.message; }
}
$('#phNew').addEventListener('click', () => openPhone(true));
$('#phClose').addEventListener('click', () => $('#dlgPhone').close());
$('#dlgPhone').addEventListener('close', () => api.phoneStop());
api.on('phone-synced', r => {
  $('#phStatus').className = 'ph-status ok';
  $('#phStatus').textContent = `✅ Điện thoại đã nhận ${r.count} việc lúc ${fmtFull(toLocal(new Date(r.at)))}`;
  toast(`📱 Đã đồng bộ ${r.count} việc sang điện thoại`);
});

$('#btnExcel').addEventListener('click', e => { e.stopPropagation(); $('#excelMenu').classList.toggle('hidden'); });
document.addEventListener('click', e => {
  const x = e.target.closest('[data-x]'); if (x) { e.preventDefault(); excel(x.dataset.x); return; }
  if (!e.target.closest('.menu-wrap')) $('#excelMenu').classList.add('hidden');
});

// ---------- Điều hướng ----------
$('#views').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.view = b.dataset.view; state.project = null; saveUi(); render();
});
$('#projects').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.project = b.dataset.project; saveUi(); render();
});
$('#modes').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.mode = b.dataset.mode; saveUi(); render();
});
$('#search').addEventListener('input', e => { state.q = e.target.value; render(); });

$('#content').addEventListener('click', async e => {
  if (e.target.id === 'toggleDone' || e.target.closest('#toggleDone')) { state.showDone = !state.showDone; render(); return; }
  const cal = e.target.closest('[data-cal]');
  if (cal) {
    const n = +cal.dataset.cal, base = state.calMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    state.calMonth = n === 0 ? null : new Date(base.getFullYear(), base.getMonth() + n, 1); render(); return;
  }
  const add = e.target.closest('.col-add');
  if (add) { openForm(null, { status: add.dataset.status, progress: add.dataset.status === DONE ? 100 : 0 }); return; }
  const tick = e.target.closest('.tick');
  const holder = e.target.closest('[data-id]');
  if (tick && holder) { const t = tasks.find(x => x.id === holder.dataset.id); return setDone(t, !isDone(t), tick); }
  if (holder) { openForm(tasks.find(x => x.id === holder.dataset.id)); return; }
  const day = e.target.closest('.day');
  if (day) { const [y, m, d] = day.dataset.date.split('-').map(Number); openForm(null, { deadline: toLocal(new Date(y, m - 1, d, 17, 0)), remindBefore: '1' }); }
});

// Kéo thả trên bảng Kanban
$('#content').addEventListener('dragstart', e => {
  const c = e.target.closest('.card'); if (!c) return;
  e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('dragging');
});
$('#content').addEventListener('dragend', e => e.target.closest?.('.card')?.classList.remove('dragging'));
$('#content').addEventListener('dragover', e => {
  const col = e.target.closest('.col'); if (!col) return;
  e.preventDefault(); $$('.col').forEach(c => c.classList.toggle('over', c === col));
});
$('#content').addEventListener('drop', async e => {
  const col = e.target.closest('.col'); if (!col) return;
  e.preventDefault(); $$('.col').forEach(c => c.classList.remove('over'));
  const t = tasks.find(x => x.id === e.dataTransfer.getData('text/plain'));
  const s = col.dataset.status; if (!t || t.status === s) return;
  const patch = { id: t.id, status: s };
  if (s === DONE) { patch.progress = 100; patch.alerting = false; }
  else if (isDone(t)) patch.progress = s === 'Chưa bắt đầu' ? 0 : 50;
  else if (s === 'Đang thực hiện' && !t.progress) patch.progress = 10;
  await api.save(patch);
  if (s === DONE) toast(`🎉 Đã xong "${t.title}"`);
});

$('#alerts').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = b.closest('.alert-item').dataset.id;
  if (b.dataset.m === 'tomorrow') { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); await api.snooze(id, 0, toLocal(d)); toast('Sẽ nhắc lại lúc 8:00 sáng mai'); }
  else if (b.dataset.m) { await api.snooze(id, +b.dataset.m); toast(`Sẽ nhắc lại sau ${countdown(toLocal(new Date(Date.now() + b.dataset.m * 60000 + 30000)))}`); }
  if (b.dataset.a === 'done') { const t = tasks.find(x => x.id === id); await setDone(t, true); }
  if (b.dataset.a === 'dismiss') await api.dismiss(id);
});

// ---------- Cài đặt ----------
for (let h = 5; h <= 22; h++) $('#setHour').insertAdjacentHTML('beforeend', `<option value="${h}">${pad(h)}:00</option>`);
$('#btnSettings').addEventListener('click', async () => {
  const s = await api.getSettings();
  $('#setLogin').checked = !!s.openAtLogin;
  $('#setBrief').checked = s.briefEnabled !== false;
  $('#setBriefTime').value = s.briefTime || '08:00';
  $('#setHour').value = s.defaultRemindHour ?? 8;
  $('#setPopup').checked = s.popupEnabled !== false;
  $('#setSound').checked = s.soundEnabled !== false;
  $('#dlgSettings').showModal();
});
$('#setLogin').addEventListener('change', e => api.setSettings({ openAtLogin: e.target.checked }));
$('#setBrief').addEventListener('change', e => api.setSettings({ briefEnabled: e.target.checked }));
$('#setBriefTime').addEventListener('change', e => api.setSettings({ briefTime: e.target.value || '08:00' }));
$('#setPopup').addEventListener('change', e => api.setSettings({ popupEnabled: e.target.checked }));
$('#setSound').addEventListener('change', e => api.setSettings({ soundEnabled: e.target.checked }));
$('#setHour').addEventListener('change', e => api.setSettings({ defaultRemindHour: +e.target.value }));

// Phím tắt: Ctrl/Cmd+N thêm việc, Ctrl/Cmd+F tìm, / để gõ nhanh
document.addEventListener('keydown', e => {
  if ($('#dlg').open || $('#dlgSettings').open) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); openForm(); }
  else if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); $('#search').focus(); }
  else if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $('#quick').focus(); }
});

api.on('tasks-changed', reload);
api.on('new-task', () => { $('#quick').focus(); });
api.on('focus-task', id => {
  state.view = 'all'; state.project = null; state.mode = 'list'; state.q = ''; $('#search').value = ''; render();
  const el = document.querySelector(`.task[data-id="${id}"]`);
  if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); }
});

reload();
setInterval(render, 60 * 1000);
