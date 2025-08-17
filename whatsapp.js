// Módulo responsável por gerenciar múltiplas sessões do WhatsApp
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { adicionarCliente } from './clientes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pastaDados = path.join(__dirname, 'dados');

if (!fs.existsSync(pastaDados)) fs.mkdirSync(pastaDados, { recursive: true });

const sessoes = new Map();

export function createSession(nome, janela) {
  const cliente = new Client({
    authStrategy: new LocalAuth({ clientId: nome })
  });

  const pastaSessao = path.join(pastaDados, nome);
  if (!fs.existsSync(pastaSessao)) fs.mkdirSync(pastaSessao, { recursive: true });

  cliente.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    janela.webContents.send('session-qr', { nome, qr });
  });

  cliente.on('ready', () => {
    janela.webContents.send('session-status', { nome, status: 'online' });
  });

  cliente.on('disconnected', () => {
    janela.webContents.send('session-status', { nome, status: 'offline' });
  });

  cliente.on('message', msg => {
    const numero = msg.from.replace('@c.us', '');
    adicionarCliente(nome, numero);
    const arquivo = path.join(pastaSessao, `${numero}.json`);
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

export function removeSession(nome) {
  const cliente = sessoes.get(nome);
  if (cliente) {
    cliente.destroy();
    sessoes.delete(nome);
  }
}
