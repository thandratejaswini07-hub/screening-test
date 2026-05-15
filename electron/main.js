const { app, BrowserWindow, shell, dialog } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
 
const isDev = process.env.NODE_ENV === 'development'
let backendProcess = null
let mainWindow = null
 
// ── Start FastAPI backend automatically ──────────────────────────────────────
function startBackend() {
  if (isDev) return  // In dev, backend is started manually
 
  // In production, start the bundled Python backend
  const backendPath = path.join(process.resourcesPath, 'backend')
  backendProcess = spawn('python', ['-m', 'uvicorn', 'app.main:app', '--port', '8000'], {
    cwd: backendPath,
    stdio: 'pipe',
  })
 
  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`)
  })
 
  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend error: ${data}`)
  })
}
 
// ── Create the main window ───────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'MNR Vision Screening',
    backgroundColor: '#f9fafb',
  })
 
  if (isDev) {
    // Load Vite dev server
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // Load built React app
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
 
  // Open external links in system browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
 
  mainWindow.on('closed', () => { mainWindow = null })
}
 
// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startBackend()
 
  // Wait for backend to start before opening window (in production)
  if (!isDev) {
    setTimeout(createWindow, 3000)  // give Python 3s to start
  } else {
    createWindow()
  }
})
 
app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})
 
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
 
app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill()
})