// Hiểu câu nhập nhanh tiếng Việt, ví dụ: "Họp giao ban 9h sáng mai !cao #Website @Lan"
(function (root) {
  const WEEKDAYS = { 'chủ nhật': 0, 'cn': 0, 'thứ 2': 1, 'thứ hai': 1, 't2': 1, 'thứ 3': 2, 'thứ ba': 2, 't3': 2, 'thứ 4': 3, 'thứ tư': 3, 't4': 3, 'thứ 5': 4, 'thứ năm': 4, 't5': 4, 'thứ 6': 5, 'thứ sáu': 5, 't6': 5, 'thứ 7': 6, 'thứ bảy': 6, 't7': 6 };
  const PRI = { 'cao': 'high', 'gấp': 'high', 'khẩn': 'high', '1': 'high', 'tb': 'medium', 'vừa': 'medium', '2': 'medium', 'thấp': 'low', '3': 'low' };
  const B = '(^|\\s)', E = '(?=$|\\s|[,.;])';

  function parse(input, now = new Date(), projects = []) {
    let text = ' ' + input + ' ';
    const out = { title: '', project: null, owner: null, priority: null, date: null, time: null, repeat: null, before: null };
    const take = (re, fn) => { text = text.replace(re, (...m) => { fn(m); return ' '; }); };

    take(new RegExp(B + '#(\\S+)', 'giu'), m => {
      const raw = m[2].replace(/_/g, ' ');
      const k = s => s.toLowerCase().replace(/\s+/g, '');
      out.project = projects.find(p => k(p) === k(raw)) || projects.find(p => k(p).startsWith(k(raw))) || raw;
    });
    take(new RegExp(B + '@(\\S+)', 'giu'), m => { out.owner = m[2].replace(/_/g, ' '); });
    take(new RegExp(B + '!(cao|gấp|khẩn|tb|vừa|thấp|[123])' + E, 'giu'), m => { out.priority = PRI[m[2].toLowerCase()]; });
    take(new RegExp(B + '(hằng|hàng|mỗi)\\s+(ngày|tuần|tháng)' + E, 'giu'), m => { out.repeat = { 'ngày': 'daily', 'tuần': 'weekly', 'tháng': 'monthly' }[m[3].toLowerCase()]; });

    // Nhắc trước hạn: "nhắc trước 1 ngày, 2 giờ, 30 phút" (đặt trước quy tắc giờ để "2 giờ" không bị hiểu là 2:00)
    take(new RegExp(B + '(?:nhắc\\s+)?trước\\s+((?:\\d+(?:[.,]\\d+)?\\s*(?:tuần|ngày|tiếng|giờ|phút|p|g|n|h)(?:\\s*(?:,|và)\\s*|\\s+)?)+)' + E, 'giu'), m => {
      out.before = m[2].trim().replace(/\s*(,|và)\s*$/u, '').replace(/\s+và\s+/gu, ', ');
    });

    // Giờ: 9h, 9h30, 9:30, 14 giờ, kèm sáng/trưa/chiều/tối
    take(new RegExp(B + '(?:lúc\\s+)?(\\d{1,2})(?:h|:|\\s?giờ\\s?)(\\d{2})?(?:p|\\s?phút)?(?:\\s+(sáng|trưa|chiều|tối))?' + E, 'giu'), m => {
      let h = +m[2]; const min = +(m[3] || 0); const part = (m[4] || '').toLowerCase();
      if ((part === 'chiều' || part === 'tối') && h < 12) h += 12;
      if (part === 'trưa' && h < 11) h += 12;
      if (h < 24 && min < 60) out.time = [h, min];
    });

    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const plus = n => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
    const wd = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');
    take(new RegExp(B + '(?:vào\\s+)?(' + wd + ')(\\s+tuần\\s+sau)?' + E, 'giu'), m => {
      const target = WEEKDAYS[m[2].toLowerCase()];
      let diff = (target - base.getDay() + 7) % 7 || 7;
      if (m[3]) diff = ((target + 6) % 7) - ((base.getDay() + 6) % 7) + 7;
      out.date = plus(diff);
    });

    take(new RegExp(B + '(hôm nay|tối nay|chiều nay|sáng nay|nay)' + E, 'gu'), m => {
      out.date = base;
      const w = m[2].toLowerCase();
      if (!out.time && w === 'tối nay') out.time = [20, 0];
      if (!out.time && w === 'chiều nay') out.time = [14, 0];
    });
    take(new RegExp(B + '(ngày mai|mai)' + E, 'gu'), () => { out.date = plus(1); });
    take(new RegExp(B + '(ngày kia|mốt)' + E, 'gu'), () => { out.date = plus(2); });
    take(new RegExp(B + '(tuần sau|tuần tới)' + E, 'giu'), () => { out.date = plus(7 - ((base.getDay() + 6) % 7)); });
    take(new RegExp(B + '(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2,4}))?' + E, 'gu'), m => {
      let y = m[4] ? +m[4] : base.getFullYear(); if (y < 100) y += 2000;
      let d = new Date(y, +m[3] - 1, +m[2]);
      if (!m[4] && d < base) d = new Date(y + 1, +m[3] - 1, +m[2]);
      if (!isNaN(d)) out.date = d;
    });
    if (out.time && !out.date) {
      out.date = base;
      if (out.time[0] * 60 + out.time[1] <= now.getHours() * 60 + now.getMinutes()) out.date = plus(1);
    }
    out.title = text.replace(/\s+/g, ' ').replace(/\s+(lúc|vào|ngày)\s*$/i, '').trim();
    return out;
  }

  const api = { parse };
  if (typeof module !== 'undefined') module.exports = api; else root.QuickAdd = api;
})(this);
