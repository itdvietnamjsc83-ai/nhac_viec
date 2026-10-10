// Cửa sổ cảnh báo nổi: hiện các việc đến giờ, cho cộng thêm thời gian hoặc đánh dấu xong
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const toLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fitHeight = () => api.alertResize(document.querySelector('header').offsetHeight + document.querySelector('#list').scrollHeight + 10);
const fmt = s => { const d = new Date(s); return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
const SNOOZE = [[5, '+5 phút'], [10, '+10 phút'], [15, '+15 phút'], [30, '+30 phút'], [60, '+1 giờ'], [120, '+2 giờ'], ['tomorrow', '8:00 sáng mai']];
let settings = {};

function beep() {
  if (settings.soundEnabled === false) return;
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = i === 2 ? 1046 : 880; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.25);
    });
  } catch {}
}

async function render() {
  const tasks = (await api.list()).filter(t => t.alerting && t.status !== 'Hoàn thành');
  if (!tasks.length) { api.alertClose(); return; }
  $('#head').textContent = tasks.length > 1 ? `Đến giờ nhắc ${tasks.length} việc` : 'Đến giờ nhắc việc';
  $('#list').innerHTML = tasks.map(t => {
    const late = t.deadline && new Date(t.deadline) < new Date();
    const meta = [
      t.project && `📁 ${esc(t.project)}`,
      t.deadline && `<span class="${late ? 'late' : ''}">📅 hạn ${fmt(t.deadline)}${late ? ' (đã quá hạn)' : ''}</span>`,
      t.snoozeCount ? `đã hoãn ${t.snoozeCount} lần` : ''
    ].filter(Boolean).join(' · ');
    return `<div class="item" data-id="${t.id}">
      <div class="title">${esc(t.title)}</div>
      <div class="meta">${meta || 'Đến giờ thực hiện'}</div>
      <div class="lbl">Cộng thêm thời gian, việc vẫn nằm trong hàng đợi:</div>
      <div class="snooze">${SNOOZE.map(([v, l]) => `<button data-s="${v}">${l}</button>`).join('')}<button data-a="custom">Tùy chọn…</button></div>
      <div class="custom"><span>Thêm</span><input type="number" min="1" value="45"><select><option value="1">phút</option><option value="60">giờ</option><option value="1440">ngày</option></select><button data-a="apply-num">Đặt</button></div>
      <div class="custom"><span>Hoặc nhắc lúc</span><input type="datetime-local"><button data-a="apply-dt">Đặt</button></div>
      <div class="actions"><button class="done" data-a="done">✓ Đã xong</button><button data-a="dismiss">Đã xem</button><span class="spacer"></span><button class="link" data-a="open">Mở chi tiết</button></div>
    </div>`;
  }).join('');
  requestAnimationFrame(fitHeight);
}

document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'close') return api.alertClose();
  const item = b.closest('.item'); if (!item) return;
  const id = item.dataset.id;
  if (b.dataset.s) {
    if (b.dataset.s === 'tomorrow') { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); await api.snooze(id, 0, toLocal(d)); }
    else await api.snooze(id, +b.dataset.s);
  } else if (b.dataset.a === 'custom') {
    item.querySelectorAll('.custom').forEach(c => c.classList.toggle('on'));
    fitHeight();
  } else if (b.dataset.a === 'apply-num') {
    const num = +item.querySelector('.custom input[type=number]').value;
    const unit = +item.querySelector('.custom select').value;
    if (num > 0) await api.snooze(id, num * unit);
  } else if (b.dataset.a === 'apply-dt') {
    const dt = item.querySelector('.custom input[type=datetime-local]').value;
    if (dt && new Date(dt) > new Date()) await api.snooze(id, 0, dt);
  } else if (b.dataset.a === 'done') await api.save({ id, status: 'Hoàn thành', progress: 100, alerting: false });
  else if (b.dataset.a === 'dismiss') await api.dismiss(id);
  else if (b.dataset.a === 'open') api.openMain(id);
});

api.on('tasks-changed', render);
api.on('alert-ring', beep);
(async () => { settings = await api.getSettings(); await render(); beep(); })();
