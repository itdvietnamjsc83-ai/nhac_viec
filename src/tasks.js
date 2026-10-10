// Lưu trữ và xử lý danh sách việc (không phụ thuộc Electron để dễ kiểm thử)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Remind = require('./renderer/remind.js');

const pad = n => String(n).padStart(2, '0');
// Chuỗi thời gian địa phương dạng "YYYY-MM-DDTHH:mm" (khớp với ô datetime-local)
const toLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const key = t => `${(t.project || '').trim().toLowerCase()}||${t.title.trim().toLowerCase()}`;

class TaskStore {
  constructor(dir) {
    this.file = path.join(dir, 'nhac-viec-data.json');
    this.data = { tasks: [], settings: { openAtLogin: false, defaultRemindHour: 8, briefEnabled: true, briefTime: '08:00', lastBrief: null, popupEnabled: true, soundEnabled: true } };
    try {
      const loaded = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = { ...this.data, ...loaded, settings: { ...this.data.settings, ...loaded.settings } };
    } catch { /* lần chạy đầu */ }
    this.data.tasks.forEach(migrate);
  }

  /** Tính lại mốc nhắc kế tiếp từ: giờ nhắc riêng + các mốc "nhắc trước hạn". */
  reschedule(t, now = new Date()) {
    const all = Remind.schedule(t, this.data.settings.defaultRemindHour ?? 8);
    // Mốc chưa nhắc: sau lần nhắc gần nhất. Mốc đã qua nhưng chưa nhắc lần nào vẫn được nhắc ngay.
    const after = t.lastFiredAt || '';
    const next = all.find(x => x > after);
    t.remindAt = next || null;
    t.notified = !next;
    t.alerting = false;
    return t;
  }
  /** Các mốc nhắc của một việc (để hiển thị). */
  scheduleOf(t) { return Remind.schedule(t, this.data.settings.defaultRemindHour ?? 8); }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
  list() { return this.data.tasks; }
  get(id) { return this.data.tasks.find(t => t.id === id); }

  upsert(input) {
    const now = new Date().toISOString();
    let t = input.id && this.get(input.id);
    // Bản cũ / bên ngoài gửi "remindAt" = giờ nhắc riêng do người dùng đặt
    if (input.remindAt !== undefined && input.remindManual === undefined) { input = { ...input, remindManual: input.remindAt }; }
    const { remindAt: _ignored, ...rest } = input;
    input = rest;
    if (t) {
      const remindChanged = ['remindManual', 'remindBefore', 'deadline'].some(k => input[k] !== undefined && (input[k] || null) !== (t[k] || null));
      const wasDone = t.status === 'Hoàn thành';
      Object.assign(t, input, { updatedAt: now });
      if (remindChanged) { t.lastFiredAt = null; this.reschedule(t); }
      const isDone = t.status === 'Hoàn thành';
      if (isDone && !wasDone) {
        if (!input.completedAt) t.completedAt = toLocal(new Date());
        log(t, 'done');
      } else if (!isDone && wasDone) {
        t.completedAt = null;
        log(t, 'reopen');
      }
    } else {
      t = {
        id: crypto.randomUUID(), title: '', note: '', project: '', owner: '',
        start: null, deadline: null, remindAt: null, remindManual: null, remindBefore: '', lastFiredAt: null, repeat: 'none',
        progress: 0, status: 'Chưa bắt đầu', priority: '', checklist: [], completedAt: null, snoozeCount: 0, history: [], source: 'manual',
        notified: false, alerting: false, createdAt: now, updatedAt: now,
        ...input
      };
      t.id = t.id || crypto.randomUUID();
      this.reschedule(t);
      this.data.tasks.push(t);
    }
    if (t.status === 'Hoàn thành') {
      t.progress = 100; t.alerting = false;
      if (!t.completedAt) t.completedAt = toLocal(new Date());
    }
    this.save();
    return t;
  }

  remove(id) {
    this.data.tasks = this.data.tasks.filter(t => t.id !== id);
    this.save();
  }

  /** Nhập các dòng đọc từ Excel. Trùng "Dự án + Công việc" thì cập nhật. */
  importRows(rows) {
    const byKey = new Map(this.data.tasks.map(t => [key(t), t]));
    let added = 0, updated = 0;
    for (const r of rows) {
      let deadline = null;
      if (r.deadline) {
        const dl = new Date(r.deadline);
        if (!r.deadlineHasTime) dl.setHours(17, 0, 0, 0);   // không ghi giờ: hạn cuối ngày làm việc
        deadline = toLocal(dl);
      }
      const remindBefore = r.remindBefore != null ? String(r.remindBefore) : (r.remindDays != null ? String(r.remindDays) : '1');
      const fields = {
        project: r.project, title: r.title, owner: r.owner, note: r.note,
        start: r.start ? toLocal(r.start).slice(0, 10) : null,
        deadline, remindBefore,
        progress: r.progress, status: r.status, source: 'excel',
        ...(r.priority ? { priority: r.priority } : {}),
        ...(r.completedAt ? { completedAt: toLocal(r.completedAt) } : {})
      };
      const existing = byKey.get(key(fields));
      if (existing) { this.upsert({ ...fields, id: existing.id }); updated++; }
      else { const t = this.upsert(fields); byKey.set(key(t), t); added++; }
    }
    return { added, updated };
  }

  /** Trả về các việc vừa đến giờ nhắc; đánh dấu đã nhắc / dời lịch lặp lại. */
  collectDue(now = new Date()) {
    const due = [];
    for (const t of this.data.tasks) {
      if (!t.remindAt || t.notified || t.status === 'Hoàn thành') continue;
      if (new Date(t.remindAt) > now) continue;
      due.push(t);
      const nowL = toLocal(now);
      t.lastFiredAt = nowL;
      if (t.repeat && t.repeat !== 'none' && t.remindManual) {
        // Việc lặp lại: dời giờ nhắc riêng sang kỳ sau (giữ đúng thứ / ngày trong tháng)
        const next = new Date(t.remindManual);
        while (toLocal(next) <= nowL) {
          if (t.repeat === 'daily') next.setDate(next.getDate() + 1);
          else if (t.repeat === 'weekly') next.setDate(next.getDate() + 7);
          else if (t.repeat === 'monthly') next.setMonth(next.getMonth() + 1);
          else break;
        }
        t.remindManual = toLocal(next);
      }
      this.reschedule(t, now);
      t.alerting = true;
    }
    if (due.length) this.save();
    return due;
  }

  /** Tóm tắt đầu ngày: trả về {today, overdue} một lần mỗi ngày sau giờ cài đặt. */
  dailyBrief(now = new Date()) {
    const st = this.data.settings;
    if (!st.briefEnabled) return null;
    const day = toLocal(now).slice(0, 10);
    if (st.lastBrief === day || toLocal(now).slice(11) < (st.briefTime || '08:00')) return null;
    st.lastBrief = day;
    this.save();
    const open = this.data.tasks.filter(t => t.status !== 'Hoàn thành');
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return {
      today: open.filter(t => t.deadline && new Date(t.deadline) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && new Date(t.deadline) < end),
      overdue: open.filter(t => t.deadline && new Date(t.deadline) < new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    };
  }

  /** Hoãn nhắc: thêm số phút, hoặc đến một thời điểm cụ thể ("YYYY-MM-DDTHH:mm"). Việc vẫn nằm trong hàng đợi. */
  snooze(id, minutes, until) {
    const t = this.get(id); if (!t) return;
    const at = until ? new Date(until) : new Date(Date.now() + minutes * 60000);
    t.remindAt = toLocal(at);
    // Mốc tự động nào trước giờ hoãn coi như đã nhắc, tránh bật lại sớm hơn giờ người dùng chọn
    if (!t.lastFiredAt || t.lastFiredAt < toLocal(new Date())) t.lastFiredAt = toLocal(new Date());
    t.notified = false; t.alerting = false;
    t.snoozeCount = (t.snoozeCount || 0) + 1;
    log(t, 'snooze', t.remindAt);
    this.save();
  }
  /** Gói toàn bộ dữ liệu để chuyển sang máy khác. */
  exportBackup(version) {
    const { lastBrief, openAtLogin, ...settings } = this.data.settings;
    return { app: 'nhac-viec', version, exportedAt: new Date().toISOString(), settings, tasks: this.data.tasks };
  }

  /** Nhập dữ liệu từ máy khác. mode = 'merge' (gộp, giữ bản mới hơn) hoặc 'replace' (thay toàn bộ). */
  importBackup(data, mode = 'merge') {
    if (!data || data.app !== 'nhac-viec' || !Array.isArray(data.tasks)) throw new Error('File không phải dữ liệu sao lưu của Nhắc Việc');
    const incoming = data.tasks.filter(t => t && t.id && t.title);
    let added = 0, updated = 0, kept = 0;
    if (mode === 'replace') {
      incoming.forEach(migrate);
      this.data.tasks = incoming;
      added = incoming.length;
      if (data.settings) Object.assign(this.data.settings, data.settings);
    } else {
      const byId = new Map(this.data.tasks.map(t => [t.id, t]));
      for (const t of incoming) {
        const cur = byId.get(t.id);
        migrate(t);
        if (!cur) { this.data.tasks.push(t); added++; }
        else if ((t.updatedAt || '') > (cur.updatedAt || '')) { Object.assign(cur, t); updated++; }
        else kept++;
      }
    }
    this.save();
    return { added, updated, kept, total: this.data.tasks.length };
  }

  dismiss(id) { const t = this.get(id); if (t) { t.alerting = false; this.save(); } }
}

// Dữ liệu bản ≤1.2: chỉ có remindAt (+ remindDays nếu nhập từ Excel) -> chuyển sang quy tắc mới, giữ nguyên giờ nhắc kế tiếp
function migrate(t) {
  if (t.remindBefore !== undefined || t.remindManual !== undefined) return t;
  if (t.source === 'excel' && t.remindDays != null) { t.remindBefore = String(t.remindDays); t.remindManual = null; }
  else { t.remindBefore = ''; t.remindManual = t.remindAt || null; }
  delete t.remindDays;
  t.lastFiredAt = t.notified && t.remindAt ? t.remindAt : null;
  return t;
}

// Nhật ký ngắn của từng việc (hoãn, hoàn thành, mở lại) để theo dõi tình hình
function log(t, action, value) {
  t.history = t.history || [];
  t.history.push({ at: toLocal(new Date()), action, ...(value ? { value } : {}) });
  if (t.history.length > 30) t.history.splice(0, t.history.length - 30);
}

module.exports = { TaskStore, toLocal, migrate };
