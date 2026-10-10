// Kiểm thử nhanh: tạo file mẫu rồi đọc lại
const os = require('os'), path = require('path'), assert = require('assert');
const { writeTemplate, readProjectFile } = require('../src/excel');
(async () => {
  const f = path.join(os.tmpdir(), 'nhacviec-test.xlsx');
  await writeTemplate(f);
  const { rows, errors } = await readProjectFile(f);
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(rows.length, 7);
  assert.strictEqual(rows[2].project, 'Website công ty');
  assert.strictEqual(rows[2].progress, 60);
  assert.ok(rows[0].deadline instanceof Date);
  assert.strictEqual(rows[5].status, 'Hoàn thành');
  // Giờ hạn: cột "Giờ hạn" (09:00) và giờ ghi ngay trong ô hạn (09:30)
  assert.deepStrictEqual([rows[0].deadline.getHours(), rows[0].deadline.getMinutes(), rows[0].deadlineHasTime], [9, 0, true]);
  assert.deepStrictEqual([rows[1].deadline.getHours(), rows[1].deadline.getMinutes(), rows[1].deadlineHasTime], [9, 30, true]);
  assert.strictEqual(rows[2].deadlineHasTime, false);
  assert.strictEqual(rows[0].remindBefore, '3 ngày, 1 ngày, 2 giờ, 30 phút');
  console.log('OK: đọc được', rows.length, 'dòng');
})().catch(e => { console.error(e); process.exit(1); });

// Kiểm thử lưu trữ + nhắc việc
(async () => {
  const fs = require('fs');
  const { TaskStore } = require('../src/tasks');
  const { readProjectFile, writeTemplate } = require('../src/excel');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nv-'));
  const f = path.join(dir, 'm.xlsx');
  await writeTemplate(f);
  const store = new TaskStore(dir);
  const { rows } = await readProjectFile(f);
  assert.deepStrictEqual(store.importRows(rows), { added: 7, updated: 0 });
  assert.deepStrictEqual(store.importRows(rows), { added: 0, updated: 7 });
  // Mô phỏng 30 ngày sau: mọi việc chưa hoàn thành đều đến hạn nhắc
  const due = store.collectDue(new Date(Date.now() + 30 * 86400000));
  assert.strictEqual(due.length, 6);
  assert.strictEqual(store.collectDue(new Date(Date.now() + 30 * 86400000)).length, 0);
  const r = store.upsert({ title: 'Họp giao ban', remindAt: '2020-01-06T09:00', repeat: 'weekly' });
  assert.strictEqual(store.collectDue().length, 1);
  assert.ok(new Date(store.get(r.id).remindAt) > new Date());
  assert.strictEqual(new Date(store.get(r.id).remindAt).getDay(), 1); // vẫn là thứ Hai
  const again = new TaskStore(dir);
  assert.strictEqual(again.list().length, 8);
  const { writeTasks } = require('../src/excel');
  await writeTasks(path.join(dir, 'out.xlsx'), again.list());
  const back = await readProjectFile(path.join(dir, 'out.xlsx'));
  assert.strictEqual(back.rows.length, 8);
  const bid = back.rows.find(x => x.title === 'Mở thầu');
  assert.deepStrictEqual([bid.deadline.getHours(), bid.deadline.getMinutes(), bid.remindBefore], [9, 30, '1 ngày, 1 giờ']);
  console.log('OK: lưu trữ, nhắc lặp lại, xuất/nhập lại Excel');
})().catch(e => { console.error(e); process.exit(1); });

// Kiểm thử cột Ưu tiên và tóm tắt đầu ngày
(async () => {
  const fs = require('fs');
  const { TaskStore } = require('../src/tasks');
  const { readProjectFile, writeTemplate } = require('../src/excel');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nv-'));
  await writeTemplate(path.join(dir, 'm.xlsx'));
  const { rows } = await readProjectFile(path.join(dir, 'm.xlsx'));
  assert.strictEqual(rows[0].priority, 'high');
  assert.strictEqual(rows[4].priority, 'low');
  const store = new TaskStore(dir);
  store.importRows(rows);
  const morning = new Date(); morning.setHours(9, 0, 0, 0);
  const b = store.dailyBrief(new Date(morning.getTime() + 5 * 86400000));
  assert.ok(b && b.overdue.length >= 1);
  assert.strictEqual(store.dailyBrief(new Date(morning.getTime() + 5 * 86400000)), null); // chỉ một lần mỗi ngày
  const L = require('../src/renderer/lunar.js');
  assert.deepStrictEqual(L.solarToLunar(17, 2, 2026), { day: 1, month: 1, year: 2026, leap: false });
  const Q = require('../src/renderer/quickadd.js');
  const q = Q.parse('Họp giao ban 9h sáng mai !cao #web @Lan', new Date(2026, 9, 9, 15, 0), ['Website công ty']);
  assert.strictEqual(q.title, 'Họp giao ban'); assert.strictEqual(q.project, 'Website công ty');
  assert.strictEqual(q.priority, 'high'); assert.deepStrictEqual(q.time, [9, 0]);
  assert.strictEqual(q.date.getDate(), 10);
  console.log('OK: ưu tiên, tóm tắt đầu ngày, âm lịch, nhập nhanh');
})().catch(e => { console.error(e); process.exit(1); });

// Kiểm thử ghi giờ hoàn thành, hoãn nhắc, sao lưu / khôi phục sang máy khác
(async () => {
  const fs = require('fs');
  const { TaskStore } = require('../src/tasks');
  const { readProjectFile, writeTasks } = require('../src/excel');
  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'nvA-'));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'nvB-'));
  const a = new TaskStore(dirA);
  const t = a.upsert({ title: 'Gửi báo giá', remindAt: '2020-01-01T08:00' });
  a.collectDue();
  a.snooze(t.id, 15);
  assert.strictEqual(a.get(t.id).snoozeCount, 1);
  assert.ok(new Date(a.get(t.id).remindAt) > new Date());
  a.snooze(t.id, 0, '2030-01-02T08:00');
  assert.strictEqual(a.get(t.id).remindAt, '2030-01-02T08:00');
  a.upsert({ id: t.id, status: 'Hoàn thành' });
  assert.ok(a.get(t.id).completedAt, 'phải ghi giờ hoàn thành');
  assert.deepStrictEqual(a.get(t.id).history.map(h => h.action), ['snooze', 'snooze', 'done']);
  a.upsert({ id: t.id, status: 'Đang thực hiện' });
  assert.strictEqual(a.get(t.id).completedAt, null);
  a.upsert({ id: t.id, status: 'Hoàn thành', completedAt: '2026-10-09T15:42' });
  assert.strictEqual(a.get(t.id).completedAt, '2026-10-09T15:42');
  // Xuất Excel -> đọc lại vẫn còn giờ hoàn thành
  await writeTasks(path.join(dirA, 'x.xlsx'), a.list());
  const back = await readProjectFile(path.join(dirA, 'x.xlsx'));
  assert.strictEqual(back.rows[0].completedAt.getHours(), 15);
  assert.strictEqual(back.rows[0].completedAt.getMinutes(), 42);
  // Chuyển máy: máy B gộp dữ liệu từ máy A
  const b = new TaskStore(dirB);
  b.upsert({ title: 'Việc riêng máy B' });
  const pack = JSON.parse(JSON.stringify(a.exportBackup('1.2.0')));
  assert.deepStrictEqual(b.importBackup(pack, 'merge'), { added: 1, updated: 0, kept: 0, total: 2 });
  assert.deepStrictEqual(b.importBackup(pack, 'merge'), { added: 0, updated: 0, kept: 1, total: 2 });
  assert.strictEqual(b.importBackup(pack, 'replace').total, 1);
  assert.throws(() => b.importBackup({ foo: 1 }));
  console.log('OK: giờ hoàn thành, hoãn nhắc, chuyển dữ liệu sang máy khác');
})().catch(e => { console.error(e); process.exit(1); });

// Kiểm thử giờ hạn + nhắc trước tùy chỉnh nhiều mốc + chuyển dữ liệu bản cũ
(async () => {
  const fs = require('fs');
  const { TaskStore, migrate } = require('../src/tasks');
  const R = require('../src/renderer/remind.js');
  assert.deepStrictEqual(R.parse('1 ngày, 2 giờ, 30 phút'), [{ min: 1440 }, { min: 120 }, { min: 30 }]);
  assert.deepStrictEqual(R.parse('1n 2g'), [{ min: 1560 }]);
  assert.deepStrictEqual(R.parse('1,5 giờ'), [{ min: 90 }]);
  assert.deepStrictEqual(R.parse('2'), [{ days: 2 }]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nvR-'));
  const s = new TaskStore(dir);
  const t = s.upsert({ title: 'Mở thầu', deadline: '2030-03-15T09:00', remindBefore: '1 ngày, 2 giờ, 30 phút' });
  assert.deepStrictEqual(s.scheduleOf(t), ['2030-03-14T09:00', '2030-03-15T07:00', '2030-03-15T08:30']);
  assert.strictEqual(t.remindAt, '2030-03-14T09:00');
  const at = x => new Date(x);
  assert.strictEqual(s.collectDue(at('2030-03-14T08:59')).length, 0);
  assert.strictEqual(s.collectDue(at('2030-03-14T09:00')).length, 1);
  assert.strictEqual(s.get(t.id).remindAt, '2030-03-15T07:00');
  assert.strictEqual(s.collectDue(at('2030-03-15T07:01')).length, 1);
  assert.strictEqual(s.get(t.id).remindAt, '2030-03-15T08:30');
  assert.strictEqual(s.collectDue(at('2030-03-15T08:30')).length, 1);
  assert.strictEqual(s.get(t.id).notified, true);
  assert.strictEqual(s.collectDue(at('2030-03-15T10:00')).length, 0);
  // Đổi giờ hạn -> tính lại từ đầu
  s.upsert({ id: t.id, deadline: '2030-03-20T14:00' });
  assert.strictEqual(s.get(t.id).remindAt, '2030-03-19T14:00');
  // Kiểu cũ: số ngày -> 08:00
  const o = s.upsert({ title: 'Kiểu cũ', deadline: '2030-03-15T17:00', remindBefore: '1' });
  assert.strictEqual(o.remindAt, '2030-03-14T08:00');
  // Giờ nhắc riêng + nhắc trước hạn cùng lúc
  const m = s.upsert({ title: 'Cả hai', deadline: '2030-03-15T17:00', remindBefore: '1 giờ', remindManual: '2030-03-10T10:00' });
  assert.deepStrictEqual(s.scheduleOf(m), ['2030-03-10T10:00', '2030-03-15T16:00']);
  // Dữ liệu bản 1.2: remindAt + remindDays
  const old = migrate({ title: 'x', source: 'excel', remindDays: 2, deadline: '2030-01-10T17:00', remindAt: '2030-01-08T08:00', notified: false });
  assert.strictEqual(old.remindBefore, '2'); assert.strictEqual(old.remindAt, '2030-01-08T08:00');
  const man = migrate({ title: 'y', remindAt: '2030-01-08T10:00', notified: false });
  assert.strictEqual(man.remindManual, '2030-01-08T10:00');
  console.log('OK: giờ hạn, nhắc trước nhiều mốc, chuyển dữ liệu bản cũ');
})().catch(e => { console.error(e); process.exit(1); });

// Kiểm thử cổng đồng bộ sang điện thoại qua Wi-Fi
(async () => {
  const S = require('../src/phonesync');
  let pulled = 0;
  const s = await S.start({ code: '123456', port: 0, host: '127.0.0.1', getData: () => ({ app: 'nhac-viec', tasks: [{ id: 'a', title: 'x' }] }), onPulled: () => pulled++ });
  const base = `http://127.0.0.1:${s.port}`;
  let r = await fetch(`${base}/nv/123456?app=1`);
  assert.strictEqual(r.status, 200); assert.strictEqual((await r.json()).tasks.length, 1); assert.strictEqual(pulled, 1);
  r = await fetch(`${base}/nv/654321`); assert.strictEqual(r.status, 403);
  assert.match(S.newCode(), /^\d{6}$/);
  await s.stop();
  await assert.rejects(fetch(`${base}/nv/123456`));
  console.log('OK: đồng bộ sang điện thoại qua Wi-Fi');
})().catch(e => { console.error(e); process.exit(1); });
