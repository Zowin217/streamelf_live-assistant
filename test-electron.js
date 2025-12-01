// Quick test to verify Electron is working
const { app, BrowserWindow } = require('electron');

console.log('=== Electron Test ===');
console.log('Electron version:', process.versions.electron);
console.log('Node version:', process.versions.node);
console.log('App ready:', app.isReady());

app.whenReady().then(() => {
  console.log('App is ready!');
  const win = new BrowserWindow({ width: 800, height: 600 });
  win.loadURL('https://www.google.com');
  console.log('Window created');
});

