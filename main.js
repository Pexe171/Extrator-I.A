// Processo principal do Electron
import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSession, removeSession, syncSession, baixarHistorico } from './whatsapp.js';
import { adicionarCliente, obterClientes } from './clientes.js';
import { exportarConversas } from './exportador.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let janelaPrincipal;
const sessoes = [];

function criarJanela() {
  janelaPrincipal = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  janelaPrincipal.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  criarJanela();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- Comunicação via IPC ---
ipcMain.handle('get-sessions', () => sessoes);

ipcMain.on('create-session', (_e, nome) => {
  if (!sessoes.includes(nome)) {
    sessoes.push(nome);
    createSession(nome, janelaPrincipal);
  }
});

ipcMain.on('remove-session', (_e, nome) => {
  const idx = sessoes.indexOf(nome);
  if (idx !== -1) {
    sessoes.splice(idx, 1);
    removeSession(nome);
    janelaPrincipal.webContents.send('session-removed', nome);
  }
});

ipcMain.on('sync-session', (_e, nome) => {
  syncSession(nome);
});

ipcMain.handle('get-clients', async (_e, sessao) => {
  return obterClientes(sessao);
});

ipcMain.on('add-client', async (_e, { sessao, numero }) => {
  const clientes = adicionarCliente(sessao, numero);
  await baixarHistorico(sessao, numero);
  janelaPrincipal.webContents.send('clients-updated', { sessao, clientes });
});

ipcMain.handle('export-chats', (_e, { sessao, numero, formato }) => {
  return exportarConversas(sessao, numero, formato, progresso => {
    janelaPrincipal.webContents.send('export-progress', progresso);
  });
});

