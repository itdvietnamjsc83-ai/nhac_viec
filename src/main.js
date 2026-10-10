const { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu, nativeImage, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { TaskStore } = require('./tasks');
const { readProjectFile, writeTemplate, writeTasks } = require('./excel');
const PhoneSync = require('./phonesync');
const QRCode = require('qrcode');

const isMac = process.platform === 'darwin';
let win = null, alertWin = null, tray = null, store = null, quitting = false;

// Giữ cố định tên app và thư mục dữ liệu (tên file cài đặt là "NhacViec" không dấu)
const SMOKE = process.argv.includes('--smoke-test');
app.setName('Nhắc Việc');
app.setPath('userData', SMOKE
  ? fs.mkdtempSync(path.join(require('os').tmpdir(), 'nhacviec-smoke-'))
  : (process.env.NHACVIEC_DATA_DIR || path.join(app.getPath('appData'), 'Nhắc Việc')));
app.commandLine.appendSwitch('lang', 'vi'); // ô ngày giờ hiển thị kiểu Việt Nam (dd/mm/yyyy)
if (!SMOKE && !app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showWindow());
if (process.platform === 'win32') app.setAppUserModelId('vn.nhacviec.app'); // cần để Windows hiện thông báo

function asset(name) {
  // Khi đóng gói, file mẫu nằm trong resources; khi chạy dev thì ở thư mục assets
  const packed = path.join(process.resourcesPath || '', name);
  return app.isPackaged && fs.existsSync(packed) ? packed : path.join(__dirname, '..', 'assets', name);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180, height: 760, minWidth: 820, minHeight: 520,
    title: 'Nhắc Việc',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.removeMenu?.();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // Đóng cửa sổ = ẩn xuống khay hệ thống để vẫn nhắc việc
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } });
}

function showWindow(taskId) {
  if (!win) createWindow();
  win.show(); win.focus();
  if (taskId) win.webContents.send('focus-task', taskId);
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', isMac ? 'trayTemplate.png' : 'tray.png'));
  if (isMac) img.setTemplateImage(true);
  tray = new Tray(img);
  tray.setToolTip('Nhắc Việc');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở Nhắc Việc', click: () => showWindow() },
    { label: 'Thêm việc mới', click: () => { showWindow(); win.webContents.send('new-task'); } },
    { type: 'separator' },
    { label: 'Thoát', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', () => showWindow());
}

// Cửa sổ cảnh báo nổi ở góc màn hình, luôn nằm trên cùng, cho phép cộng thêm thời gian / đánh dấu xong
function showAlertWindow() {
  if (!store.data.settings.popupEnabled) return;
  if (alertWin && !alertWin.isDestroyed()) {
    alertWin.webContents.send('tasks-changed');
    alertWin.showInactive();
    alertWin.webContents.send('alert-ring');
    return;
  }
  const area = screen.getPrimaryDisplay().workArea;
  const W = 420, H = 260;
  alertWin = new BrowserWindow({
    width: W, height: H, x: area.x + area.width - W - 16, y: area.y + area.height - H - 16,
    frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true, show: false,
    minimizable: false, maximizable: false, fullscreenable: false, transparent: false,
    title: 'Nhắc Việc - Cảnh báo',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  alertWin.setAlwaysOnTop(true, 'screen-saver');
  alertWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true }); // macOS: không làm ẩn biểu tượng ở Dock
  alertWin.loadFile(path.join(__dirname, 'renderer', 'alert.html'));
  alertWin.once('ready-to-show', () => alertWin.showInactive());
  alertWin.on('closed', () => { alertWin = null; });
}

ipcMain.handle('alert:resize', (_e, h) => {
  if (!alertWin || alertWin.isDestroyed()) return;
  const area = screen.getPrimaryDisplay().workArea;
  const height = Math.max(150, Math.min(Math.round(h), area.height - 40));
  const [w] = alertWin.getSize();
  alertWin.setBounds({ x: area.x + area.width - w - 16, y: area.y + area.height - height - 16, width: w, height });
});
ipcMain.handle('alert:close', () => { if (alertWin && !alertWin.isDestroyed()) alertWin.close(); });
ipcMain.handle('app:open', (_e, id) => showWindow(id));

function notify(title, body, taskId) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: path.join(__dirname, '..', 'assets', 'icon.png') });
  n.on('click', () => showWindow(taskId));
  n.show();
}

function fmt(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function checkReminders() {
  const brief = store.dailyBrief();
  if (brief && (brief.today.length || brief.overdue.length)) {
    const parts = [];
    if (brief.today.length) parts.push(`${brief.today.length} việc đến hạn hôm nay`);
    if (brief.overdue.length) parts.push(`${brief.overdue.length} việc quá hạn`);
    notify('☀️ Chào buổi sáng!', `Hôm nay bạn có ${parts.join(' và ')}.\n` + [...brief.overdue, ...brief.today].slice(0, 3).map(t => '• ' + t.title).join('\n'));
  }
  const due = store.collectDue();
  if (!due.length) return;
  if (due.length <= 3) {
    for (const t of due) {
      const parts = [];
      if (t.project) parts.push(`Dự án: ${t.project}`);
      if (t.deadline) parts.push(`Hạn: ${fmt(t.deadline)}`);
      if (t.progress) parts.push(`Tiến độ: ${t.progress}%`);
      notify(`⏰ ${t.title}`, parts.join(' · ') || 'Đến giờ nhắc việc', t.id);
    }
  } else {
    notify(`⏰ Có ${due.length} việc cần chú ý`, due.slice(0, 4).map(t => '• ' + t.title).join('\n'));
  }
  showAlertWindow();
  broadcast();
  if (isMac) app.dock.setBadge(String(store.list().filter(t => t.alerting).length || ''));
}

function broadcast() {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('tasks-changed');
}

function sendChanged() {
  broadcast();
  if (isMac) app.dock.setBadge(String(store.list().filter(t => t.alerting).length || ''));
}

// ---------- IPC ----------
ipcMain.handle('tasks:list', () => store.list());
ipcMain.handle('tasks:save', (_e, t) => { const r = store.upsert(t); sendChanged(); return r; });
ipcMain.handle('tasks:remove', (_e, id) => { store.remove(id); sendChanged(); });
ipcMain.handle('tasks:snooze', (_e, id, min, until) => { store.snooze(id, min, until); sendChanged(); });
ipcMain.handle('tasks:dismiss', (_e, id) => { store.dismiss(id); sendChanged(); });

ipcMain.handle('settings:get', () => ({ ...store.data.settings, openAtLogin: app.getLoginItemSettings().openAtLogin }));
ipcMain.handle('settings:set', (_e, s) => {
  if ('briefTime' in s && s.briefTime !== store.data.settings.briefTime) store.data.settings.lastBrief = null;
  Object.assign(store.data.settings, s);
  store.save();
  if ('openAtLogin' in s) app.setLoginItemSettings({ openAtLogin: !!s.openAtLogin, openAsHidden: true, args: ['--hidden'] });
  return store.data.settings;
});

ipcMain.handle('excel:import', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Chọn file Excel tiến độ dự án',
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xlsm'] }], properties: ['openFile']
  });
  if (r.canceled || !r.filePaths[0]) return null;
  try {
    const { rows, errors } = await readProjectFile(r.filePaths[0]);
    const res = store.importRows(rows);
    sendChanged();
    setTimeout(checkReminders, 1500);
    return { ...res, errors, file: path.basename(r.filePaths[0]) };
  } catch (e) {
    return { added: 0, updated: 0, errors: ['Không đọc được file: ' + e.message + '. Lưu ý: chỉ hỗ trợ .xlsx (không hỗ trợ .xls cũ).'] };
  }
});

ipcMain.handle('data:export', async () => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Xuất dữ liệu để chuyển sang máy khác',
    defaultPath: `nhac-viec-du-lieu-${new Date().toISOString().slice(0, 10)}.nhacviec.json`,
    filters: [{ name: 'Dữ liệu Nhắc Việc', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, JSON.stringify(store.exportBackup(app.getVersion()), null, 2));
  shell.showItemInFolder(r.filePath);
  return { file: r.filePath, count: store.list().length };
});

// ---------- Đồng bộ sang điện thoại qua Wi-Fi ----------
let phone = null;
async function stopPhone() { if (phone) { const p = phone; phone = null; await p.stop(); } }
ipcMain.handle('phone:start', async (_e, opts = {}) => {
  await stopPhone();
  const st = store.data.settings;
  if (!st.phoneCode || opts.newCode) { st.phoneCode = PhoneSync.newCode(); store.save(); }
  phone = await PhoneSync.start({
    code: st.phoneCode,
    getData: () => store.exportBackup(app.getVersion()),
    onPulled: info => { if (win && !win.isDestroyed()) win.webContents.send('phone-synced', { count: info.count, at: info.at.toISOString() }); }
  });
  const text = phone.url || '';
  const qr = text ? await QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1b1f2a', light: '#ffffff' } }) : '';
  return { qr, url: phone.url, ips: phone.ips, port: phone.port, code: st.phoneCode, expiresAt: phone.expiresAt, count: store.list().length };
});
ipcMain.handle('phone:stop', () => stopPhone());

ipcMain.handle('data:import', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Chọn file dữ liệu Nhắc Việc từ máy khác',
    filters: [{ name: 'Dữ liệu Nhắc Việc', extensions: ['json'] }], properties: ['openFile']
  });
  if (r.canceled || !r.filePaths[0]) return null;
  let data;
  try { data = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); }
  catch { return { error: 'File không đọc được hoặc không đúng định dạng.' }; }
  if (!data || data.app !== 'nhac-viec') return { error: 'File này không phải dữ liệu xuất từ Nhắc Việc.' };
  const choice = await dialog.showMessageBox(win, {
    type: 'question', title: 'Nhập dữ liệu',
    message: `File có ${data.tasks?.length || 0} công việc. Bạn muốn nhập thế nào?`,
    detail: 'Gộp: giữ việc đang có trên máy này, thêm việc mới và cập nhật việc đã sửa gần đây hơn.\nThay thế: xóa dữ liệu trên máy này và dùng toàn bộ dữ liệu trong file.',
    buttons: ['Gộp (khuyên dùng)', 'Thay thế toàn bộ', 'Hủy'], defaultId: 0, cancelId: 2
  });
  if (choice.response === 2) return null;
  try {
    const res = store.importBackup(data, choice.response === 1 ? 'replace' : 'merge');
    sendChanged();
    return { ...res, file: path.basename(r.filePaths[0]) };
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle('excel:template', async () => {
  const r = await dialog.showSaveDialog(win, { title: 'Lưu file Excel mẫu', defaultPath: 'mau-tien-do-du-an.xlsx', filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
  if (r.canceled || !r.filePath) return null;
  const src = asset('mau-tien-do-du-an.xlsx');
  if (fs.existsSync(src)) fs.copyFileSync(src, r.filePath); else await writeTemplate(r.filePath);
  shell.showItemInFolder(r.filePath);
  return r.filePath;
});

ipcMain.handle('excel:export', async (_e, ids) => {
  const r = await dialog.showSaveDialog(win, { title: 'Xuất tiến độ ra Excel', defaultPath: `tien-do-${new Date().toISOString().slice(0, 10)}.xlsx`, filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
  if (r.canceled || !r.filePath) return null;
  const tasks = ids ? store.list().filter(t => ids.includes(t.id)) : store.list();
  await writeTasks(r.filePath, tasks);
  shell.showItemInFolder(r.filePath);
  return r.filePath;
});

// ---------- Vòng đời ----------
app.whenReady().then(() => {
  store = new TaskStore(app.getPath('userData'));
  createTray();
  const hidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAsHidden;
  createWindow();
  if (hidden) win.once('ready-to-show', () => win.hide());
  if (SMOKE) {
    // Tự kiểm tra sau khi build: mở cửa sổ, chờ giao diện tải xong rồi thoát
    win.webContents.once('did-finish-load', () => setTimeout(() => { console.log('SMOKE_OK Electron ' + process.versions.electron); app.exit(0); }, 1500));
    win.webContents.once('did-fail-load', (_e, code, desc) => { console.log('SMOKE_FAIL ' + desc); app.exit(1); });
    setTimeout(() => { console.log('SMOKE_FAIL timeout'); app.exit(1); }, 30000);
  }
  checkReminders();
  if (store.list().some(t => t.alerting && t.status !== 'Hoàn thành')) showAlertWindow();
  setInterval(checkReminders, 20 * 1000);
  app.on('activate', () => showWindow());
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* giữ chạy nền trong khay hệ thống */ });
