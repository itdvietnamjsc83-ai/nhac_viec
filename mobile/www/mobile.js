// Nhắc Việc – bản điện thoại: chỉ xem, đồng bộ từ file .nhacviec.json xuất ở bản máy tính.
// Chạy được trong trình duyệt (để thử) và trong ứng dụng Android/iOS đóng gói bằng Capacitor
// (khi đó dùng plugin LocalNotifications để đặt thông báo theo các mốc nhắc).
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, '0');
  const toLocal = Remind.toLocal;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DONE = 'Hoàn thành';
  const PRI = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
  const PRI_RANK = { high: 0, medium: 1, low: 2, '': 3 };
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const WDL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const COLORS = ['#3366ff', '#7a5af8', '#12b76a', '#f79009', '#f04438', '#0ba5ec', '#ee46bc'];
  const KEY = 'nhacviec-mobile';

  let db = load();
  const state = { view: 'today', q: '', sel: null, project: null };

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* bộ nhớ đầy / chế độ riêng tư */ } }
  const tasks = () => (db && db.tasks) || [];

  // ---------- Thời gian ----------
  const sod = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = s => Math.round((sod(new Date(s)) - sod(new Date())) / 86400000);
  const hm = s => s ? s.slice(11, 16) : '';
  function dayName(s) {
    const n = dayDiff(s), d = new Date(s);
    if (n === 0) return 'Hôm nay'; if (n === 1) return 'Ngày mai'; if (n === -1) return 'Hôm qua';
    if (n > 1 && n < 7) return WDL[d.getDay()];
    return `${WD[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }
  const full = s => s ? `${hm(s)} · ${dayName(s)}` : '';
  function lateLabel(s) {
    const h = (Date.now() - new Date(s)) / 3600000;
    if (h < 1) return `trễ ${Math.max(1, Math.round(h * 60))} phút`;
    if (h < 24) return `trễ ${Math.round(h)} giờ`;
    return `trễ ${Math.round(h / 24)} ngày`;
  }
  function countdown(s) {
    const m = Math.round((new Date(s) - Date.now()) / 60000);
    if (m < 60) return `còn ${m} phút`;
    if (m < 1440) return `còn ${Math.floor(m / 60)} giờ ${m % 60 ? (m % 60) + ' phút' : ''}`.trim();
    return `còn ${Math.round(m / 1440)} ngày`;
  }

  const isDone = t => t.status === DONE;
  const isLate = t => !isDone(t) && t.deadline && new Date(t.deadline) < new Date();
  const projColor = p => { const ps = [...new Set(tasks().map(t => t.project).filter(Boolean))].sort(); return COLORS[ps.indexOf(p) % COLORS.length] || COLORS[0]; };

  // Các mốc nhắc còn lại của một việc (giống bản máy tính) + giờ hoãn nếu có
  function remindPoints(t) {
    if (isDone(t)) return [];
    const pts = new Set(Remind.schedule(t).filter(x => x > (t.lastFiredAt || '')));
    if (t.remindAt && !t.notified) pts.add(t.remindAt);
    return [...pts].sort();
  }

  function matches(t) {
    if (state.project && t.project !== state.project) return false;
    if (!state.q) return true;
    const q = state.q.toLowerCase();
    return [t.title, t.project, t.owner, t.note].some(x => (x || '').toLowerCase().includes(q));
  }
  const byDeadline = (a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || PRI_RANK[a.priority || ''] - PRI_RANK[b.priority || ''];

  // ---------- Ô việc ----------
  function card(t, opts = {}) {
    const m = [];
    if (t.project && !state.project) m.push(`<span style="color:${projColor(t.project)}">● ${esc(t.project)}</span>`);
    if (t.owner) m.push(`<span>👤 ${esc(t.owner)}</span>`);
    const pts = remindPoints(t);
    if (t.alerting && !isDone(t)) m.push('<span class="late">🔔 đang báo</span>');
    else if (pts.length && !opts.noRemind) m.push(`<span>🔔 ${full(pts[0])}${pts.length > 1 ? ` (+${pts.length - 1})` : ''}</span>`);
    if (t.checklist && t.checklist.length) m.push(`<span>☑ ${t.checklist.filter(c => c.done).length}/${t.checklist.length}</span>`);
    if (isDone(t) && t.completedAt) m.push(`<span>✅ ${full(t.completedAt)}</span>`);
    let when = '';
    if (t.deadline && !isDone(t)) {
      const cls = isLate(t) ? 'late' : dayDiff(t.deadline) <= 1 ? 'soon' : '';
      when = `<div class="when ${cls}"><b>${hm(t.deadline)}</b>${isLate(t) ? lateLabel(t.deadline) : dayName(t.deadline)}</div>`;
    }
    const prog = !isDone(t) && t.progress ? `<div class="bar" title="${t.progress}%"><i style="width:${t.progress}%"></i></div>` : '';
    return `<div class="card ${isDone(t) ? 'is-done' : ''} ${state.sel === t.id ? 'sel' : ''}" data-id="${t.id}">
      <span class="ring ${isDone(t) ? 'done' : 'p-' + (t.priority || '')}">${isDone(t) ? '✓' : ''}</span>
      <div class="c-main"><div class="c-title">${esc(t.title)}</div><div class="meta">${m.join('')}</div></div>
      ${prog}${when}</div>`;
  }
  const group = (title, list, right = '') => list.length ? `<div class="group"><span>${title} · ${list.length}</span><span>${right}</span></div>${list.map(t => card(t)).join('')}` : '';
  const empty = (e, text) => `<div class="empty"><span class="e">${e}</span>${text}</div>`;

  // ---------- Các màn ----------
  const VIEWS = {
    today: { title: 'Hôm nay', render() {
      const open = tasks().filter(t => !isDone(t) && matches(t));
      const late = open.filter(isLate).sort(byDeadline);
      const today = open.filter(t => !isLate(t) && t.deadline && dayDiff(t.deadline) === 0).sort(byDeadline);
      const remindToday = open.filter(t => !late.includes(t) && !today.includes(t) && remindPoints(t).some(p => dayDiff(p) === 0));
      const doneToday = tasks().filter(t => isDone(t) && t.completedAt && dayDiff(t.completedAt) === 0 && matches(t));
      const hero = late.length
        ? `<div class="hero warn"><span class="n">${late.length}</span><div><b>việc đã quá hạn</b><div class="muted small">Xử lý trên máy tính hoặc báo người phụ trách</div></div></div>`
        : `<div class="hero"><span class="n">${today.length}</span><div><b>việc đến hạn hôm nay</b><div class="muted small">${doneToday.length ? `Đã xong ${doneToday.length} việc hôm nay 🎉` : 'Chúc một ngày làm việc hiệu quả'}</div></div></div>`;
      const body = group('Quá hạn', late) + group('Đến hạn hôm nay', today) + group('Có nhắc hôm nay', remindToday) + group('Đã xong hôm nay', doneToday);
      return hero + (body || empty('🌤️', 'Hôm nay không có việc nào đến hạn'));
    } },
    week: { title: '7 ngày tới', render() {
      const open = tasks().filter(t => !isDone(t) && matches(t) && t.deadline && !isLate(t) && dayDiff(t.deadline) < 7).sort(byDeadline);
      if (!open.length) return empty('📅', 'Không có việc nào đến hạn trong 7 ngày tới');
      const days = {};
      for (const t of open) (days[t.deadline.slice(0, 10)] ||= []).push(t);
      return Object.entries(days).map(([d, l]) => {
        const dt = new Date(d + 'T00:00'), lu = Lunar.solarToLunar(dt.getDate(), dt.getMonth() + 1, dt.getFullYear());
        return group(dayName(d + 'T00:00'), l, `ÂL ${lu.day}/${lu.month}`);
      }).join('');
    } },
    late: { title: 'Quá hạn', render() {
      const l = tasks().filter(t => isLate(t) && matches(t)).sort(byDeadline);
      return l.length ? group('Quá hạn', l) : empty('👏', 'Không có việc nào quá hạn');
    } },
    alerts: { title: 'Lịch nhắc', render() {
      const firing = tasks().filter(t => t.alerting && !isDone(t) && matches(t));
      const items = [];
      for (const t of tasks().filter(t => !isDone(t) && matches(t))) {
        for (const p of remindPoints(t)) if (new Date(p) >= new Date()) items.push({ t, p, snoozed: p === t.remindAt && (t.snoozeCount || 0) > 0 && !Remind.schedule(t).includes(p) });
      }
      items.sort((a, b) => a.p.localeCompare(b.p));
      let html = firing.length ? `<div class="group"><span>Đang báo · ${firing.length}</span></div>` + firing.map(t => alertRow(t, t.lastFiredAt || t.remindAt, 'firing', 'đã báo, chưa xử lý trên máy tính')).join('') : '';
      const days = {};
      for (const it of items.slice(0, 120)) (days[it.p.slice(0, 10)] ||= []).push(it);
      for (const [d, l] of Object.entries(days)) {
        html += `<div class="group"><span>${dayName(d + 'T00:00')}</span><span>${l.length} lần nhắc</span></div>`;
        html += l.map(it => alertRow(it.t, it.p, it.snoozed ? 'snoozed' : '', it.snoozed ? `đã hoãn ${it.t.snoozeCount} lần` : beforeText(it.t, it.p))).join('');
      }
      return html || empty('🔕', 'Chưa có lịch nhắc nào sắp tới');
    } },
    projects: { title: 'Dự án', render() {
      if (state.project) {
        const l = tasks().filter(matches);
        return `<div class="group"><span>${esc(state.project)}</span><span><button id="clearProj" style="color:var(--accent)">✕ Bỏ lọc</button></span></div>`
          + group('Đang làm', l.filter(t => !isDone(t)).sort(byDeadline)) + group('Đã xong', l.filter(isDone));
      }
      const ps = {};
      for (const t of tasks()) (ps[t.project || '(Không dự án)'] ||= []).push(t);
      const names = Object.keys(ps).sort();
      if (!names.length) return empty('📁', 'Chưa có dự án');
      return names.map(p => {
        const l = ps[p], done = l.filter(isDone).length, late = l.filter(isLate).length;
        const avg = Math.round(l.reduce((s, t) => s + (isDone(t) ? 100 : t.progress || 0), 0) / l.length);
        const next = l.filter(t => !isDone(t) && t.deadline).sort(byDeadline)[0];
        return `<div class="proj" data-proj="${esc(p)}"><div class="proj-h"><span>${esc(p)}</span><span style="color:${projColor(p)}">${avg}%</span></div>
          <div class="big-bar"><i style="width:${avg}%;background:${projColor(p)}"></i></div>
          <div class="meta"><span>${done}/${l.length} việc xong</span>${late ? `<span class="late">${late} quá hạn</span>` : ''}${next ? `<span>Kế tiếp: ${esc(next.title)} · ${full(next.deadline)}</span>` : ''}</div></div>`;
      }).join('');
    } },
    done: { title: 'Đã xong', render() {
      const l = tasks().filter(t => isDone(t) && matches(t)).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
      if (!l.length) return empty('✅', 'Chưa có việc nào hoàn thành');
      const withDl = l.filter(t => t.completedAt && t.deadline), onTime = withDl.filter(t => t.completedAt <= t.deadline).length;
      let html = `<div class="stats"><div class="stat grn"><b>${l.length}</b><span>đã xong</span></div>
        <div class="stat"><b>${withDl.length ? Math.round(onTime / withDl.length * 100) : 100}%</b><span>đúng hạn</span></div>
        <div class="stat red"><b>${withDl.length - onTime}</b><span>xong trễ</span></div></div>`;
      const days = {};
      for (const t of l) (days[(t.completedAt || '0000-00-00').slice(0, 10)] ||= []).push(t);
      for (const [d, g] of Object.entries(days)) html += group(d === '0000-00-00' ? 'Không rõ ngày' : dayName(d + 'T00:00'), g);
      return html;
    } }
  };
  function beforeText(t, p) {
    if (!t.deadline) return 'nhắc riêng';
    if (p === t.remindManual) return 'nhắc riêng';
    for (const r of Remind.parse(t.remindBefore)) if (r.days != null && Remind.schedule({ deadline: t.deadline, remindBefore: String(r.days) })[0] === p) return 'trước hạn ' + Remind.label(r);
    const m = Math.round((new Date(t.deadline) - new Date(p)) / 60000);
    if (m <= 0) return 'đúng giờ hạn';
    return 'trước hạn ' + Remind.label({ min: m });
  }
  function alertRow(t, p, cls, sub) {
    return `<div class="alert-item ${cls}" data-id="${t.id}"><span class="t">${hm(p)}</span><span class="ln"></span>
      <div class="c-main"><div class="c-title">${esc(t.title)}</div><div class="meta"><span>${esc(sub)}</span>${t.deadline ? `<span>hạn ${full(t.deadline)}</span>` : ''}</div></div></div>`;
  }

  // ---------- Chi tiết ----------
  function renderDetail() {
    const t = tasks().find(x => x.id === state.sel);
    if (!t) { $('#dTitle').textContent = 'Chi tiết'; $('#dBody').innerHTML = empty('👈', 'Chọn một việc để xem chi tiết'); return; }
    $('#dTitle').textContent = t.project || 'Chi tiết việc';
    const chips = [];
    chips.push(`<span class="chip ${isDone(t) ? 'ok' : 'st'}">${esc(t.status)}</span>`);
    if (t.priority) chips.push(`<span class="chip p-${t.priority}">● ${PRI[t.priority]}</span>`);
    if (isLate(t)) chips.push(`<span class="chip p-high">${lateLabel(t.deadline)}</span>`);
    if (t.alerting && !isDone(t)) chips.push(`<span class="chip p-high">🔔 đang báo</span>`);
    if (t.repeat && t.repeat !== 'none') chips.push(`<span class="chip">🔁 ${{ daily: 'Hằng ngày', weekly: 'Hằng tuần', monthly: 'Hằng tháng' }[t.repeat]}</span>`);
    const kv = (k, v) => v ? `<div class="kv"><span>${k}</span><span>${v}</span></div>` : '';
    const dl = t.deadline ? new Date(t.deadline) : null;
    const lu = dl ? Lunar.solarToLunar(dl.getDate(), dl.getMonth() + 1, dl.getFullYear()) : null;
    let html = `<div class="d-title">${esc(t.title)}</div><div class="chips">${chips.join('')}</div>
      <div class="box">${kv('📅 Hạn', dl ? `${hm(t.deadline)} · ${WDL[dl.getDay()]} ${pad(dl.getDate())}/${pad(dl.getMonth() + 1)}/${dl.getFullYear()}<br><small class="muted">Âm lịch ${lu.day}/${lu.month}</small>` : '')}
      ${kv('🚩 Bắt đầu', t.start ? t.start.split('-').reverse().join('/') : '')}
      ${kv('👤 Phụ trách', esc(t.owner))}${kv('📁 Dự án', esc(t.project))}
      ${kv('✅ Hoàn thành lúc', t.completedAt ? `${hm(t.completedAt)} ${t.completedAt.slice(0, 10).split('-').reverse().join('/')}` + (t.deadline ? `<br><small class="muted">${t.completedAt <= t.deadline ? 'đúng hạn' : 'xong trễ'}</small>` : '') : '')}
      <div class="kv"><span>Tiến độ</span><span class="big-prog" style="width:60%"><span class="bar"><i style="width:${isDone(t) ? 100 : t.progress || 0}%"></i></span>${isDone(t) ? 100 : t.progress || 0}%</span></div></div>`;
    // Lịch nhắc của việc
    const all = Remind.schedule(t);
    if (t.remindAt && !all.includes(t.remindAt) && !t.notified) all.push(t.remindAt);
    all.sort();
    if (all.length) {
      const next = remindPoints(t).find(p => new Date(p) >= new Date());
      html += `<div class="sec">🔔 Lịch nhắc${t.remindBefore ? ` · trước hạn ${esc(Remind.format(Remind.parse(t.remindBefore)))}` : ''}</div><div class="box">` + all.map(p => {
        const past = isDone(t) || (t.lastFiredAt && p <= t.lastFiredAt) || new Date(p) < new Date();
        return `<div class="rm ${past ? 'past' : ''} ${p === next ? 'next' : ''}"><span class="b">🔔</span><div>${hm(p)} · ${dayName(p)}<small>${p === t.remindAt && !Remind.schedule(t).includes(p) ? 'giờ đã hoãn tới' : beforeText(t, p)}${p === next ? ' · ' + countdown(p) : past ? ' · đã qua' : ''}</small></div></div>`;
      }).join('') + '</div>';
    }
    if (t.checklist && t.checklist.length) {
      html += `<div class="sec">Các bước · ${t.checklist.filter(c => c.done).length}/${t.checklist.length}</div><div class="box">` +
        t.checklist.map(c => `<div class="cl ${c.done ? 'done' : ''}"><span class="ring ${c.done ? 'done' : ''}">${c.done ? '✓' : ''}</span><span>${esc(c.text)}</span></div>`).join('') + '</div>';
    }
    if (t.note) html += `<div class="sec">Ghi chú</div><div class="note">${esc(t.note)}</div>`;
    if (t.history && t.history.length) {
      const H = { snooze: 'Hoãn nhắc đến', done: 'Hoàn thành', reopen: 'Mở lại' };
      html += `<div class="sec">Lịch sử</div><div class="hist">` + t.history.slice(-6).reverse().map(h => `• ${full(h.at)}: ${H[h.action] || h.action}${h.value ? ' ' + full(h.value) : ''}`).join('<br>') + '</div>';
    }
    html += `<div class="readonly">🔒 Bản điện thoại chỉ để theo dõi. Sửa việc trên máy tính rồi đồng bộ lại.</div>`;
    $('#dBody').innerHTML = html;
    $('#dBody').scrollTop = 0;
  }

  // ---------- Vẽ lại ----------
  function counts() {
    const open = tasks().filter(t => !isDone(t));
    return {
      today: open.filter(t => isLate(t) || (t.deadline && dayDiff(t.deadline) === 0)).length,
      week: open.filter(t => t.deadline && !isLate(t) && dayDiff(t.deadline) < 7).length,
      late: open.filter(isLate).length,
      alerts: open.reduce((n, t) => n + remindPoints(t).filter(p => new Date(p) >= new Date()).length, 0) + open.filter(t => t.alerting).length
    };
  }
  function render() {
    const now = new Date(), lu = Lunar.solarToLunar(now.getDate(), now.getMonth() + 1, now.getFullYear());
    $('#today').textContent = `${WDL[now.getDay()]}, ${pad(now.getDate())}/${pad(now.getMonth() + 1)} · ÂL ${lu.day}/${lu.month}`;
    $('#viewTitle').textContent = state.project && state.view === 'projects' ? state.project : VIEWS[state.view].title;
    const c = counts();
    $$('#seg button').forEach(b => { b.classList.toggle('on', b.dataset.view === state.view); const n = c[b.dataset.view], el = b.querySelector('b'); if (el) el.textContent = n ? n : ''; });
    $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.view === state.view || (b.dataset.view === 'more' && ['late', 'done'].includes(state.view))));
    $('#mLate').textContent = c.late || '';
    // Thanh đồng bộ
    if (!db) {
      $('#syncBar').innerHTML = '<span class="dot" style="background:var(--muted)"></span>Chưa có dữ liệu · bấm ⟳ để đồng bộ từ máy tính';
      $('#list').innerHTML = empty('📲', 'Chưa có dữ liệu.<br>Trên máy tính chọn <b>📦 Dữ liệu → Xuất toàn bộ dữ liệu</b>, gửi file sang điện thoại (Zalo, email, USB…), rồi bấm <b>⟳</b> ở góc trên.')
        + '<div style="padding:0 16px"><button class="big-btn primary" id="emptySync">⟳ Đồng bộ ngay</button></div>';
      return;
    }
    const exp = db.exportedAt ? new Date(db.exportedAt) : null;
    const old = exp && Date.now() - exp > 86400000;
    $('#syncBar').className = 'sync-bar' + (old ? ' old' : '');
    $('#syncBar').innerHTML = `<span class="dot"></span>Dữ liệu máy tính lúc ${exp ? `${pad(exp.getHours())}:${pad(exp.getMinutes())} ${dayName(toLocal(exp)).toLowerCase()}` : '?'} · ${tasks().length} việc${old ? ' · nên đồng bộ lại' : ''}`;
    $('#list').innerHTML = VIEWS[state.view].render();
    renderDetail();
  }

  function openTask(id) {
    state.sel = id;
    $$('.card').forEach(c => c.classList.toggle('sel', c.dataset.id === id));
    renderDetail();
    $('#app').classList.add('show-detail');
    $('#detail').setAttribute('aria-hidden', 'false');
    if (!wide()) history.pushState({ d: 1 }, '');
  }
  function closeTask() { $('#app').classList.remove('show-detail'); $('#detail').setAttribute('aria-hidden', 'true'); }
  const wide = () => matchMedia('(min-width: 700px), (horizontal-viewport-segments: 2)').matches;

  function setView(v) {
    if (v === 'more') return $('#dlgMore').showModal();
    if (v !== 'projects') state.project = null;
    state.view = v; render(); $('#list').scrollTop = 0;
    // Màn rộng: tự chọn việc đầu tiên để cột chi tiết không trống
    if (wide() && !tasks().some(t => t.id === state.sel && $(`.card[data-id="${t.id}"]`))) {
      const first = $('#list .card, #list .alert-item'); if (first) openTask(first.dataset.id);
    }
  }

  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); }

  // ---------- Đồng bộ ----------
  function applyBackup(data, label) {
    if (!data || data.app !== 'nhac-viec' || !Array.isArray(data.tasks)) throw new Error('File không phải dữ liệu xuất từ Nhắc Việc');
    db = { exportedAt: data.exportedAt, version: data.version, syncedAt: new Date().toISOString(), settings: data.settings || {}, tasks: data.tasks.filter(t => t && t.id && t.title) };
    persist(); scheduleNotifications();
    state.sel = null; render(); setView(state.view);
    toast(`Đã đồng bộ ${db.tasks.length} việc${label ? ' ' + label : ''}`);
  }
  // Dữ liệu mẫu: dời mọi mốc thời gian để "hôm nay" của mẫu trùng với hôm nay thật
  function demo() {
    const shift = Date.now() - new Date(window.DEMO.exportedAt).getTime();
    const days = Math.round(shift / 86400000);
    const mv = s => { if (!s || typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(s)) return s; const d = new Date(s.length === 10 ? s + 'T00:00' : s); d.setDate(d.getDate() + days); return s.length === 10 ? toLocal(d).slice(0, 10) : toLocal(d); };
    const data = JSON.parse(JSON.stringify(window.DEMO));
    for (const t of data.tasks) for (const k of ['start', 'deadline', 'remindAt', 'remindManual', 'completedAt', 'lastFiredAt']) t[k] = mv(t[k]);
    data.exportedAt = new Date(Date.now() - 25 * 60000).toISOString();
    applyBackup(data, '(dữ liệu mẫu)');
  }

  // ---------- Đồng bộ qua Wi-Fi (máy tính mở cổng tạm, xem src/phonesync.js) ----------
  const LINK = KEY + '-link';
  // Chấp nhận: http://192.168.1.5:47800/nv/123456  hoặc địa chỉ + mã nhập tay
  function parseLink(text, code) {
    text = String(text || '').trim();
    let m = text.match(/^https?:\/\/([\w.-]+(?::\d+)?)\/nv\/(\d{6})/);
    if (m) return { host: m[1], code: m[2] };
    m = text.replace(/^https?:\/\//, '').match(/^([\d.]+|[\w.-]+)(?::(\d+))?\/?$/);
    const c = String(code || '').replace(/\D/g, '');
    if (m && c.length === 6) return { host: m[1] + ':' + (m[2] || '47800'), code: c };
    return null;
  }
  async function pull(link) {
    toast('Đang nhận dữ liệu từ ' + link.host.split(':')[0] + '…');
    let res;
    try { res = await fetch(`http://${link.host}/nv/${link.code}?app=1`, { headers: { Accept: 'application/json' } }); }
    catch { throw new Error('Không kết nối được máy tính. Kiểm tra chung Wi-Fi và cửa sổ đồng bộ trên máy tính đang mở.'); }
    const body = await res.text();
    let data; try { data = JSON.parse(body); } catch { throw new Error('Máy tính trả về dữ liệu lạ'); }
    if (!res.ok) throw new Error(data.error || 'Lỗi ' + res.status);
    try { localStorage.setItem(LINK, JSON.stringify(link)); } catch { }
    applyBackup(data, 'qua Wi-Fi');
    $('#dlgSync').open && $('#dlgSync').close();
  }
  const savedLink = () => { try { return JSON.parse(localStorage.getItem(LINK)); } catch { return null; } };
  async function scan() {
    const BS = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BarcodeScanner;
    if (!BS) { toast('Bản xem thử trên web không mở được camera. Hãy nhập địa chỉ và mã.'); return showManual(); }
    try {
      if (window.Capacitor.getPlatform() === 'android') {
        const { available } = await BS.isGoogleBarcodeScannerModuleAvailable();
        if (!available) { toast('Đang tải bộ quét mã của Google, thử lại sau ít giây…'); await BS.installGoogleBarcodeScannerModule(); return; }
      } else {
        const p = await BS.requestPermissions(); if (p.camera !== 'granted' && p.camera !== 'limited') return toast('Chưa được phép dùng camera');
      }
      const { barcodes } = await BS.scan({ formats: ['QR_CODE'] });
      if (!barcodes.length) return;
      const link = parseLink(barcodes[0].rawValue);
      if (!link) return toast('Mã QR này không phải của Nhắc Việc');
      await pull(link);
    } catch (e) { toast(e.message || String(e)); }
  }
  function showManual() {
    $('#manual').classList.remove('hidden');
    const l = savedLink(); if (l && !$('#mAddr').value) $('#mAddr').value = l.host;
    $('#mAddr').focus();
  }
  const native = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function prepSync() {
    if (!native()) {
      // Bản web (iPhone qua Safari): trình duyệt không cho tải dữ liệu từ máy tính qua Wi-Fi (http) và không đặt được thông báo hẹn giờ
      ['#btnAgain', '#btnScan', '#btnManual', '#manual', '#optNotif'].forEach(s => $(s).classList.add('hidden'));
      $('.or').classList.add('hidden');
      $('label.big-btn').classList.add('primary');
      $('#dlgSync p.muted').innerHTML = 'Trên máy tính chọn <b>📦 Dữ liệu → 📤 Xuất toàn bộ dữ liệu</b>, gửi file <code>.nhacviec.json</code> sang điện thoại (Zalo, email, AirDrop…).';
      $('#webNote').classList.remove('hidden');
      $('#webNote').innerHTML = isIOS
        ? 'iPhone: trong Zalo / Mail, mở file → <b>Chia sẻ → Lưu vào Tệp</b>, rồi bấm nút trên và chọn file trong <b>Tệp</b>. Ghim app: Safari → <b>Chia sẻ → Thêm vào MH chính</b>.'
        : 'Đây là bản web. Bản cài Android (APK) đồng bộ được qua Wi-Fi và có thông báo nhắc giờ.';
      return;
    }
    const l = savedLink();
    $('#btnAgain').classList.toggle('hidden', !l);
    if (l) $('#btnAgain').textContent = `⟳ Lấy lại từ máy tính ${l.host.split(':')[0]}`;
    $('#btnScan').classList.toggle('primary', !l);
    $('#manual').classList.add('hidden');
  }

  // Thông báo trên điện thoại: khi chạy trong app Capacitor, đặt lịch cho mọi mốc nhắc sắp tới
  async function scheduleNotifications() {
    const LN = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
    if (!LN || !db) return;
    const on = localStorage.getItem(KEY + '-notif') !== '0';
    const pending = await LN.getPending(); if (pending.notifications.length) await LN.cancel(pending);
    if (!on) return;
    const perm = await LN.requestPermissions(); if (perm.display !== 'granted') return toast('Chưa được phép gửi thông báo');
    const list = [];
    for (const t of tasks()) for (const p of remindPoints(t)) {
      if (new Date(p) <= new Date()) continue;
      list.push({ id: list.length + 1, title: `🔔 ${t.title}`, body: [t.deadline ? `Hạn ${full(t.deadline)}` : '', t.project].filter(Boolean).join(' · '), schedule: { at: new Date(p), allowWhileIdle: true }, extra: { id: t.id } });
    }
    list.sort((a, b) => a.schedule.at - b.schedule.at);
    await LN.schedule({ notifications: list.slice(0, 60) });   // iOS giới hạn 64 thông báo chờ
  }

  // ---------- Sự kiện ----------
  document.addEventListener('click', e => {
    const c = e.target.closest('.card, .alert-item'); if (c) return openTask(c.dataset.id);
    const p = e.target.closest('.proj'); if (p) { state.project = p.dataset.proj; return render(); }
    if (e.target.id === 'clearProj') { state.project = null; return render(); }
    if (e.target.id === 'emptySync') return openSync();
    const v = e.target.closest('[data-view]'); if (v) { $('#dlgMore').open && $('#dlgMore').close(); return setView(v.dataset.view); }
    if (e.target.closest('[data-go=sync]')) { $('#dlgMore').close(); openSync(); }
  });
  $('#btnBack').addEventListener('click', () => history.state && history.state.d ? history.back() : closeTask());
  addEventListener('popstate', closeTask);
  const openSync = () => { prepSync(); $('#dlgSync').showModal(); };
  $('#btnSync').addEventListener('click', openSync);
  $('#btnScan').addEventListener('click', scan);
  $('#btnManual').addEventListener('click', showManual);
  $('#btnAgain').addEventListener('click', () => pull(savedLink()).catch(e => toast(e.message)));
  $('#mCode').addEventListener('input', e => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); e.target.value = d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d; });
  $('#manual').addEventListener('submit', e => {
    e.preventDefault();
    const link = parseLink($('#mAddr').value, $('#mCode').value);
    if (!link) return toast('Nhập địa chỉ dạng 192.168.1.5:47800 và đủ 6 số mã');
    pull(link).catch(err => toast(err.message));
  });
  $('#btnDemo').addEventListener('click', () => { $('#dlgSync').close(); demo(); });
  $('#file').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { applyBackup(JSON.parse(await f.text())); $('#dlgSync').close(); }
    catch (err) { toast('Không đọc được file: ' + err.message); }
    e.target.value = '';
  });
  $('#notifOn').checked = localStorage.getItem(KEY + '-notif') !== '0';
  $('#notifOn').addEventListener('change', e => { localStorage.setItem(KEY + '-notif', e.target.checked ? '1' : '0'); scheduleNotifications(); });
  $('#q').addEventListener('input', e => { state.q = e.target.value.trim(); render(); });
  // Vuốt từ mép trái để đóng chi tiết (điện thoại thanh)
  let sx = null;
  $('#detail').addEventListener('touchstart', e => { sx = e.touches[0].clientX < 40 ? e.touches[0].clientX : null; }, { passive: true });
  $('#detail').addEventListener('touchend', e => { if (sx != null && e.changedTouches[0].clientX - sx > 80) $('#btnBack').click(); sx = null; });
  // Gập / mở máy: chuyển giữa 1 cột và 2 cột
  matchMedia('(min-width: 700px)').addEventListener('change', () => { if (wide()) closeTask(); setView(state.view); });
  setInterval(render, 60000);   // cập nhật đếm ngược / quá hạn mỗi phút

  // Bản web: lưu sẵn để mở khi không có mạng
  if (!native() && 'serviceWorker' in navigator && location.protocol === 'https:' && !window.AUTO_DEMO) navigator.serviceWorker.register('sw.js').catch(() => {});

  // URL ?demo=1 để xem thử ngay
  if (!db && (window.AUTO_DEMO || new URLSearchParams(location.search).has('demo'))) demo(); else { render(); setView('today'); }
})();
