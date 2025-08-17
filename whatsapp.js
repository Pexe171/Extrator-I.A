// Módulo responsável por gerenciar múltiplas sessões do WhatsApp
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pastaDados = path.join(__dirname, 'dados');

if (!fs.existsSync(pastaDados)) fs.mkdirSync(pastaDados, { recursive: true });

const sessoes = new Map();

// Cria uma nova sessão e trata eventos básicos
export function createSession(nome, janela) {
  const cliente = new Client({
    authStrategy: new LocalAuth({ clientId: nome })
  });

  cliente.on('qr', qr => {
    // Exibe QR Code no console para autenticação
    qrcode.generate(qr, { small: true });
  });

  cliente.on('ready', () => {
    janela.webContents.send('session-status', { nome, status: 'online' });
  });

  cliente.on('disconnected', () => {
    janela.webContents.send('session-status', { nome, status: 'offline' });
  });

  // Salva mensagens recebidas em arquivos separados por número
  cliente.on('message', msg => {
    const numero = msg.from.replace('@c.us', '');
    const arquivo = path.join(pastaDados, `${numero}.json`);
    let historico = [];
    if (fs.existsSync(arquivo)) {
      try { historico = JSON.parse(fs.readFileSync(arquivo)); } catch { historico = []; }
    }
    historico.push({
      de: msg.from,
      corpo: msg.body,
      data: new Date().toISOString()
    });
    fs.writeFileSync(arquivo, JSON.stringify(historico, null, 2));
  });

  cliente.initialize();
  sessoes.set(nome, cliente);
}

// Exporta conversas em JSON ou TXT
export function exportChat(numero, formato = 'json') {
  const arquivoJson = path.join(pastaDados, `${numero}.json`);
  if (!fs.existsSync(arquivoJson)) return;

  if (formato === 'txt') {
    const historico = JSON.parse(fs.readFileSync(arquivoJson));
    const linhas = historico.map(m => `[${m.data}] ${m.de}: ${m.corpo}`).join('\n');
    fs.writeFileSync(path.join(pastaDados, `${numero}.txt`), linhas);
  }
  // Se JSON, nada a fazer pois o arquivo já existe
}
