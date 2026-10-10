// Đọc / tạo file Excel tiến độ dự án (dùng chung cho app và script kiểm thử)
const ExcelJS = require('exceljs');

// Cột của file mẫu. "keys" là các tên tiêu đề được chấp nhận (không phân biệt hoa thường, dấu cách).
const COLUMNS = [
  { field: 'project',   header: 'Dự án',            width: 26, keys: ['dự án', 'du an', 'project'] },
  { field: 'title',     header: 'Công việc',        width: 36, keys: ['công việc', 'cong viec', 'task', 'đầu việc'] },
  { field: 'owner',     header: 'Người phụ trách',  width: 20, keys: ['người phụ trách', 'nguoi phu trach', 'owner', 'phụ trách'] },
  { field: 'start',     header: 'Ngày bắt đầu',     width: 15, keys: ['ngày bắt đầu', 'ngay bat dau', 'start', 'bắt đầu'] },
  { field: 'deadline',  header: 'Hạn hoàn thành',   width: 17, keys: ['hạn hoàn thành', 'han hoan thanh', 'deadline', 'hạn', 'ngày kết thúc'] },
  { field: 'dueTime',   header: 'Giờ hạn',          width: 10, keys: ['giờ hạn', 'gio han', 'giờ', 'gio', 'time', 'giờ đến hạn'] },
  { field: 'progress',  header: 'Tiến độ (%)',      width: 12, keys: ['tiến độ (%)', 'tiến độ', 'tien do', 'progress', '%'] },
  { field: 'status',    header: 'Trạng thái',       width: 16, keys: ['trạng thái', 'trang thai', 'status'] },
  { field: 'priority',  header: 'Ưu tiên',          width: 12, keys: ['ưu tiên', 'uu tien', 'mức ưu tiên', 'priority'] },
  { field: 'remindBefore', header: 'Nhắc trước', width: 22, keys: ['nhắc trước', 'nhac truoc', 'nhắc trước (ngày)', 'nhắc trước hạn', 'remind'] },
  { field: 'completedAt', header: 'Hoàn thành lúc', width: 18, keys: ['hoàn thành lúc', 'hoan thanh luc', 'ngày hoàn thành', 'completed'] },
  { field: 'note',      header: 'Ghi chú',          width: 36, keys: ['ghi chú', 'ghi chu', 'note', 'mô tả'] }
];

const STATUSES = ['Chưa bắt đầu', 'Đang thực hiện', 'Tạm dừng', 'Hoàn thành'];
const PRIORITIES = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };

function toPriority(v) {
  const s = norm(cellValue(v));
  if (['cao', 'gấp', 'khẩn', 'high', '1'].includes(s)) return 'high';
  if (['trung bình', 'trung binh', 'tb', 'medium', '2'].includes(s)) return 'medium';
  if (['thấp', 'thap', 'low', '3'].includes(s)) return 'low';
  return '';
}

const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

function cellValue(v) {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result);          // ô công thức
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
    if ('text' in v) return v.text;                          // hyperlink
  }
  return v;
}

// Chấp nhận Date, số serial Excel, hoặc chuỗi dd/mm/yyyy, yyyy-mm-dd
function toDate(v) {
  v = cellValue(v);
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    // ExcelJS trả ngày theo UTC -> chuyển về ngày địa phương
    return new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate());
  }
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}

// Ngày giờ (giữ cả giờ phút) -> Date địa phương
function toDateTime(v) {
  v = cellValue(v);
  if (v instanceof Date) return new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(), v.getUTCHours(), v.getUTCMinutes());
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  }
  return toDate(v);
}

// Giờ trong ngày -> {h, m}. Chấp nhận "09:00", "9h", "9h30", số thập phân của Excel (0.375), hoặc ô kiểu giờ
function toTime(v) {
  v = cellValue(v);
  if (v == null || v === '') return null;
  if (v instanceof Date) return { h: v.getUTCHours(), m: v.getUTCMinutes() };
  if (typeof v === 'number') { const t = Math.round((v % 1) * 1440); return { h: Math.floor(t / 60) % 24, m: t % 60 }; }
  const m = String(v).trim().toLowerCase().match(/^(\d{1,2})\s*(?:[:h]|giờ)\s*(\d{1,2})?/);
  if (m && +m[1] < 24) return { h: +m[1], m: +(m[2] || 0) };
  return null;
}

function toPercent(v) {
  v = cellValue(v);
  if (v == null || v === '') return 0;
  let n = typeof v === 'number' ? v : parseFloat(String(v).replace('%', '').replace(',', '.'));
  if (isNaN(n)) return 0;
  if (n > 0 && n <= 1 && typeof v === 'number') n *= 100;   // ô định dạng % (0.4 = 40%)
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toStatus(v, progress) {
  const s = norm(cellValue(v));
  const found = STATUSES.find(x => norm(x) === s);
  if (found) return found;
  if (progress >= 100) return 'Hoàn thành';
  if (progress > 0) return 'Đang thực hiện';
  return 'Chưa bắt đầu';
}

/**
 * Đọc file Excel, trả về { rows, errors }.
 * Tìm sheet có dòng tiêu đề chứa "Dự án" và "Công việc" (trong 10 dòng đầu).
 */
async function readProjectFile(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const rows = [], errors = [];
  let used = false;

  for (const ws of wb.worksheets) {
    let headerRow = null, map = null;
    for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
      const m = {};
      ws.getRow(r).eachCell((cell, col) => {
        const h = norm(cellValue(cell.value));
        const c = COLUMNS.find(c => c.keys.includes(h));
        if (c && !(c.field in m)) m[c.field] = col;
      });
      if ('project' in m && 'title' in m) { headerRow = r; map = m; break; }
    }
    if (!headerRow) continue;
    used = true;

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = f => (map[f] ? row.getCell(map[f]).value : null);
      const project = String(cellValue(get('project')) ?? '').trim();
      const title = String(cellValue(get('title')) ?? '').trim();
      if (!project && !title) continue;
      if (!title) { errors.push(`Sheet "${ws.name}" dòng ${r}: thiếu tên công việc`); continue; }
      const progress = toPercent(get('progress'));
      const rb = cellValue(get('remindBefore'));
      // Hạn có thể kèm giờ ngay trong ô (15/10/2026 09:00) hoặc ghi ở cột "Giờ hạn"
      let deadline = toDateTime(get('deadline')), hasTime = false;
      if (deadline) {
        const tm = toTime(get('dueTime'));
        if (tm) { deadline.setHours(tm.h, tm.m, 0, 0); hasTime = true; }
        else hasTime = deadline.getHours() !== 0 || deadline.getMinutes() !== 0;
      }
      rows.push({
        project: project || '(Không tên dự án)',
        title,
        owner: String(cellValue(get('owner')) ?? '').trim(),
        start: toDate(get('start')),
        deadline, deadlineHasTime: hasTime,
        progress,
        status: toStatus(get('status'), progress),
        priority: toPriority(get('priority')),
        remindBefore: rb == null || String(rb).trim() === '' ? '1' : (rb instanceof Date ? '1' : String(rb).trim()),
        note: String(cellValue(get('note')) ?? '').trim(),
        completedAt: toDateTime(get('completedAt')),
        sourceRow: `${ws.name}!${r}`
      });
    }
  }
  if (!used) errors.push('Không tìm thấy dòng tiêu đề có cột "Dự án" và "Công việc". Hãy dùng file mẫu.');
  return { rows, errors };
}

/** Tạo file Excel mẫu có dữ liệu ví dụ, danh sách chọn trạng thái và sheet hướng dẫn. */
async function writeTemplate(filePath) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nhắc Việc';
  const ws = wb.addWorksheet('Tiến độ dự án', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUMNS.map(c => ({ header: c.header, key: c.field, width: c.width }));

  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F6FEB' } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  const today = new Date();
  const d = (n, h = 0, m = 0) => new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + n, h, m));
  // Cột: Dự án, Công việc, Phụ trách, Bắt đầu, Hạn, Giờ hạn, Tiến độ, Trạng thái, Ưu tiên, Nhắc trước, Hoàn thành lúc, Ghi chú
  const samples = [
    ['Gói thầu XL-01', 'Đóng thầu (nộp hồ sơ dự thầu)', 'Dũng', d(-7), d(4), '09:00', 70, 'Đang thực hiện', 'Cao', '3 ngày, 1 ngày, 2 giờ, 30 phút', null, 'Nộp trước giờ đóng thầu'],
    ['Gói thầu XL-01', 'Mở thầu', 'Dũng', d(4), d(4, 9, 30), null, 0, 'Chưa bắt đầu', 'Cao', '1 ngày, 1 giờ', null, 'Ô hạn có thể ghi kèm giờ: 15/10/2026 09:30'],
    ['Website công ty', 'Thiết kế giao diện trang chủ', 'Lan', d(-10), d(3), null, 60, 'Đang thực hiện', 'Cao', '1', null, 'Không có giờ: hạn tính 17:00, nhắc 8:00 trước 1 ngày'],
    ['Website công ty', 'Lập trình trang liên hệ', 'Minh', d(-2), d(7), '14:00', 20, 'Đang thực hiện', 'Trung bình', '2 ngày, 3 giờ', null, ''],
    ['Website công ty', 'Kiểm thử và bàn giao', 'Hùng', d(8), d(14), null, 0, 'Chưa bắt đầu', 'Thấp', '1', null, ''],
    ['Phần mềm kế toán', 'Khảo sát yêu cầu', 'Dũng', d(-20), d(-5), null, 100, 'Hoàn thành', '', '0', d(-6, 16, 30), 'Đã có biên bản'],
    ['Phần mềm kế toán', 'Phân tích thiết kế CSDL', 'Dũng', d(-4), d(5), '10:00', 35, 'Đang thực hiện', 'Cao', '1 ngày', null, '']
  ];
  samples.forEach(s => ws.addRow(s));

  for (let r = 2; r <= 200; r++) {
    ws.getCell(`D${r}`).numFmt = 'dd/mm/yyyy';
    ws.getCell(`E${r}`).numFmt = 'dd/mm/yyyy hh:mm';
    ws.getCell(`K${r}`).numFmt = 'dd/mm/yyyy hh:mm';
    ws.getCell(`F${r}`).numFmt = '@';   // giờ ghi dạng chữ 09:00 cho dễ nhập
    ws.getCell(`J${r}`).numFmt = '@';
    ws.getCell(`D${r}`).dataValidation = { type: 'date', operator: 'greaterThan', allowBlank: true, formulae: [new Date(2000, 0, 1)], showErrorMessage: true, error: 'Nhập ngày dạng dd/mm/yyyy' };
    ws.getCell(`E${r}`).dataValidation = { type: 'date', operator: 'greaterThan', allowBlank: true, formulae: [new Date(2000, 0, 1)], showErrorMessage: true, error: 'Nhập ngày dạng dd/mm/yyyy hoặc dd/mm/yyyy hh:mm' };
    ws.getCell(`F${r}`).dataValidation = { type: 'custom', allowBlank: true, formulae: ['TRUE'], showInputMessage: true, promptTitle: 'Giờ hạn', prompt: 'Không bắt buộc. Ví dụ 09:00 hoặc 14:30. Bỏ trống = 17:00' };
    ws.getCell(`G${r}`).dataValidation = { type: 'whole', operator: 'between', allowBlank: true, formulae: [0, 100], showErrorMessage: true, error: 'Tiến độ từ 0 đến 100' };
    ws.getCell(`H${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${STATUSES.join(',')}"`] };
    ws.getCell(`I${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Cao,Trung bình,Thấp"'] };
    ws.getCell(`J${r}`).dataValidation = { type: 'custom', allowBlank: true, formulae: ['TRUE'], showInputMessage: true, promptTitle: 'Nhắc trước hạn', prompt: 'Ví dụ: 1 ngày, 2 giờ, 30 phút (nhắc 3 lần). Chỉ ghi số = số ngày, nhắc lúc 8:00.' };
  }

  const help = wb.addWorksheet('Hướng dẫn');
  help.getColumn(1).width = 22; help.getColumn(2).width = 80;
  help.addRow(['HƯỚNG DẪN NHẬP FILE TIẾN ĐỘ']).font = { bold: true, size: 14 };
  help.addRow([]);
  [
    ['Dự án', 'Bắt buộc. Tên dự án; các dòng cùng tên được gom thành một dự án.'],
    ['Công việc', 'Bắt buộc. Tên đầu việc.'],
    ['Người phụ trách', 'Không bắt buộc.'],
    ['Ngày bắt đầu', 'Định dạng dd/mm/yyyy.'],
    ['Hạn hoàn thành', 'dd/mm/yyyy, hoặc kèm giờ: dd/mm/yyyy hh:mm (vd. 15/10/2026 09:30 cho giờ mở thầu).'],
    ['Giờ hạn', 'Không bắt buộc. Giờ đến hạn, vd. 09:00, 14h30. Bỏ trống và ô hạn không có giờ thì hạn tính 17:00.'],
    ['Tiến độ (%)', 'Số từ 0 đến 100.'],
    ['Trạng thái', STATUSES.join(' / ') + '. Bỏ trống thì tự suy ra từ tiến độ.'],
    ['Ưu tiên', 'Cao / Trung bình / Thấp. Không bắt buộc.'],
    ['Nhắc trước', 'Nhắc trước giờ hạn bao lâu, nhiều mốc cách nhau dấu phẩy. Vd: "1 ngày, 2 giờ, 30 phút" = nhắc 3 lần. Viết tắt được: 2n, 3g, 45p, 1 tuần.'],
    ['', 'Chỉ ghi số (vd. 1) = kiểu cũ: nhắc lúc 08:00 trước hạn 1 ngày. 0 = 08:00 sáng ngày đến hạn. Bỏ trống = 1.'],
    ['Hoàn thành lúc', 'Ngày giờ hoàn thành (dd/mm/yyyy hh:mm). Phần mềm tự ghi khi bạn đánh dấu xong.'],
    ['Ghi chú', 'Không bắt buộc.'],
    [],
    ['Lưu ý', 'Nhập lại cùng file: việc trùng "Dự án + Công việc" sẽ được cập nhật tiến độ, không tạo bản sao.'],
    ['', 'Việc đã "Hoàn thành" sẽ không được nhắc.']
  ].forEach(r => { const row = help.addRow(r); row.getCell(1).font = { bold: true }; row.getCell(2).alignment = { wrapText: true }; });

  await wb.xlsx.writeFile(filePath);
}

module.exports = { readProjectFile, writeTemplate, COLUMNS, STATUSES, PRIORITIES };

/** Xuất danh sách việc ra file Excel theo đúng định dạng file mẫu (có thể nhập lại). */
async function writeTasks(filePath, tasks) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Tiến độ dự án', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUMNS.map(c => ({ header: c.header, key: c.field, width: c.width }));
  ws.getRow(1).eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F6FEB' } };
  });
  const asDate = s => { if (!s) return null; const d = new Date(s); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); };
  const asDateTime = s => { if (!s) return null; const d = new Date(s); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes())); };
  for (const t of tasks) {
    const row = ws.addRow({
      project: t.project || '', title: t.title, owner: t.owner || '',
      start: asDate(t.start), deadline: asDate(t.deadline), dueTime: t.deadline ? t.deadline.slice(11, 16) : null,
      progress: t.progress || 0, status: t.status, priority: PRIORITIES[t.priority] || '',
      remindBefore: t.remindBefore ?? (t.remindDays != null ? String(t.remindDays) : null), note: t.note || '',
      completedAt: asDateTime(t.completedAt)
    });
    row.getCell('completedAt').numFmt = 'dd/mm/yyyy hh:mm';
    row.getCell('start').numFmt = 'dd/mm/yyyy';
    row.getCell('deadline').numFmt = 'dd/mm/yyyy';
  }
  await wb.xlsx.writeFile(filePath);
}
module.exports.writeTasks = writeTasks;
