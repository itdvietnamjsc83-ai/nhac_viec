const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  list: () => ipcRenderer.invoke('tasks:list'),
  save: t => ipcRenderer.invoke('tasks:save', t),
  remove: id => ipcRenderer.invoke('tasks:remove', id),
  snooze: (id, min, until) => ipcRenderer.invoke('tasks:snooze', id, min, until),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  alertResize: h => ipcRenderer.invoke('alert:resize', h),
  alertClose: () => ipcRenderer.invoke('alert:close'),
  openMain: id => ipcRenderer.invoke('app:open', id),
  dismiss: id => ipcRenderer.invoke('tasks:dismiss', id),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: s => ipcRenderer.invoke('settings:set', s),
  importExcel: () => ipcRenderer.invoke('excel:import'),
  saveTemplate: () => ipcRenderer.invoke('excel:template'),
  exportExcel: ids => ipcRenderer.invoke('excel:export', ids),
  phoneStart: opts => ipcRenderer.invoke('phone:start', opts),
  phoneStop: () => ipcRenderer.invoke('phone:stop'),
  on: (ch, fn) => {
    if (['tasks-changed', 'focus-task', 'new-task', 'alert-ring', 'phone-synced'].includes(ch)) ipcRenderer.on(ch, (_e, ...a) => fn(...a));
  }
});
