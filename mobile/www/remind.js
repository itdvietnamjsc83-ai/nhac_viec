// Quy tắc "nhắc trước hạn": dùng chung cho tiến trình chính, giao diện và bản điện thoại.
//   "1 ngày, 2 giờ, 30 phút"  -> 3 lần nhắc: trước hạn đúng 1 ngày, 2 giờ, 30 phút
//   "1n 2g", "90p", "1 tuần"   -> viết tắt cũng được
//   "1" (chỉ có số)            -> kiểu cũ: lúc 08:00 của ngày trước hạn 1 ngày
(function (root) {
  const pad = n => String(n).padStart(2, '0');
  const toLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const UNITS = [
    [/^(tuần|tuan|w|t)$/, 10080], [/^(ngày|ngay|d|n)$/, 1440],
    [/^(giờ|gio|tiếng|tieng|h|g)$/, 60], [/^(phút|phut|p|m|ph)$/, 1]
  ];

  function parse(str) {
    const rules = [];
    if (str == null) return rules;
    for (const part of String(str).toLowerCase().split(/;|\n|\svà\s|,(?!\d)|(?<!\d),/)) {
      const s = part.trim();
      if (!s) continue;
      if (/^\d+$/.test(s)) { rules.push({ days: +s }); continue; }      // kiểu cũ: số ngày, nhắc lúc 08:00
      let min = 0, ok = false;
      const re = /(\d+(?:[.,]\d+)?)\s*([a-zà-ỹđ]+)/giu;
      let m;
      while ((m = re.exec(s))) {
        const u = UNITS.find(([r]) => r.test(m[2]));
        if (!u) continue;
        min += Math.round(parseFloat(m[1].replace(',', '.')) * u[1]); ok = true;
      }
      if (ok && min > 0) rules.push({ min });
    }
    return rules;
  }

  function label(rule) {
    if (rule.days != null) return rule.days === 0 ? 'sáng ngày đến hạn' : `${rule.days} ngày (lúc 8:00)`;
    let m = rule.min; const out = [];
    for (const [n, u] of [[10080, 'tuần'], [1440, 'ngày'], [60, 'giờ'], [1, 'phút']]) {
      if (m >= n) { out.push(`${Math.floor(m / n)} ${u}`); m %= n; }
    }
    return out.join(' ');
  }
  const format = rules => rules.map(label).join(', ');

  // Danh sách thời điểm nhắc (chuỗi "YYYY-MM-DDTHH:mm"), đã sắp xếp, không trùng
  function schedule(task, defaultHour = 8) {
    const out = new Set();
    if (task.remindManual) out.add(task.remindManual);
    if (task.deadline) {
      const dl = new Date(task.deadline);
      for (const r of parse(task.remindBefore)) {
        let d;
        if (r.days != null) { d = new Date(dl); d.setDate(d.getDate() - r.days); d.setHours(defaultHour, 0, 0, 0); }
        else d = new Date(dl.getTime() - r.min * 60000);
        out.add(toLocal(d));
      }
    }
    return [...out].sort();
  }

  const api = { parse, format, label, schedule, toLocal };
  if (typeof module !== 'undefined') module.exports = api; else root.Remind = api;
})(this);
