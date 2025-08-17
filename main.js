// Processo principal do Electron
// Responsável por criar a janela e gerenciar a comunicação com o WhatsApp
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createSession, exportChat } from './whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let janelaPrincipal;
const sessoes = [];
const arquivoClientes = path.join(__dirname, 'clientes.json');

// Lê a lista de clientes cadastrados
function lerClientes() {
  if (!fs.existsSync(arquivoClientes)) return {};
  return JSON.parse(fs.readFileSync(arquivoClientes));
}

// Salva a lista de clientes
function salvarClientes(dados) {
  fs.writeFileSync(arquivoClientes, JSON.stringify(dados, null, 2));
}

// Cria a janela principal do aplicativo
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
// Retorna lista de sessões existentes
ipcMain.handle('get-sessions', () => sessoes);

// Cria nova sessão e inicia autenticação
ipcMain.on('create-session', (_e, nome) => {
  if (!sessoes.includes(nome)) {
    sessoes.push(nome);
    createSession(nome, janelaPrincipal);
  }
});

// Retorna clientes de uma sessão
ipcMain.handle('get-clients', (_e, sessao) => {
  const dados = lerClientes();
  return dados[sessao] || [];
});

// Adiciona cliente e informa a interface
ipcMain.on('add-client', (_e, { sessao, numero }) => {
  const dados = lerClientes();
  if (!dados[sessao]) dados[sessao] = [];
  if (!dados[sessao].includes(numero)) dados[sessao].push(numero);
  salvarClientes(dados);
  janelaPrincipal.webContents.send('clients-updated', { sessao, clientes: dados[sessao] });
});

// Exporta conversas de um cliente
ipcMain.on('export-chats', (_e, { numero, formato }) => {
  exportChat(numero, formato);
});
