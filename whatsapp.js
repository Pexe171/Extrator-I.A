// Módulo responsável por gerenciar múltiplas sessões do WhatsApp
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registrarErro, registrarHistorico } from './logger.js';
import { obterClientes, normalizarNumero } from './clientes.js';

// Flags para otimizar o uso de memória do Chromium
const PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--single-process',
  '--no-zygote',
  '--renderer-process-limit=1'
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pastaDados = path.join(__dirname, 'dados');
const pastaSessoes = path.join(pastaDados, 'sessions');

if (!fs.existsSync(pastaDados)) fs.mkdirSync(pastaDados, { recursive: true });
if (!fs.existsSync(pastaSessoes)) fs.mkdirSync(pastaSessoes, { recursive: true });

const sessoes = new Map();

export function createSession(nome, janela) {
  const cliente = new Client({
    authStrategy: new LocalAuth({
      clientId: nome,
      dataPath: pastaSessoes
    }),
    puppeteer: {
      headless: true,
      args: PUPPETEER_ARGS
    }
  });

  const pastaSessao = path.join(pastaDados, nome);
  if (!fs.existsSync(pastaSessao)) fs.mkdirSync(pastaSessao, { recursive: true });

  cliente.on('qr', async qr => {
    qrcode.generate(qr, { small: true });
    try {
      const qrImg = await QRCode.toDataURL(qr);
      janela.webContents.send('session-qr', { nome, qr: qrImg });
    } catch (err) {
      registrarErro(`Falha ao gerar QR Code: ${err.message}`);
    }
  });

  cliente.on('ready', () => {
    janela.webContents.send('session-status', { nome, status: 'online' });
  });

  cliente.on('disconnected', () => {
    janela.webContents.send('session-status', { nome, status: 'offline' });
    registrarErro(`Sessão ${nome} desconectada.`);
  });

  cliente.on('message', msg => {
    if (msg.from.endsWith('@g.us')) return;
    const numero = normalizarNumero(msg.from.replace('@c.us', ''));
    const clientesSessao = obterClientes(nome);
    if (!clientesSessao.includes(numero)) return;
    const arquivo = path.join(pastaSessao, `${numero}.json`);
    let historico = [];
    if (fs.existsSync(arquivo)) {
      try { historico = JSON.parse(fs.readFileSync(arquivo)); } catch { historico = []; }
    }
    historico.push({
      de: msg.fromMe ? 'empresa' : 'cliente',
      texto: msg.body,
      hora: new Date().toISOString()
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

export async function syncSession(nome) {
  const cliente = sessoes.get(nome);
  if (cliente) {
    try {
      await cliente.getChats();
    } catch (err) {
      registrarErro(`Falha ao sincronizar ${nome}: ${err.message}`);
    }
  }
}

export async function getContactName(sessao, numero) {
  const cliente = sessoes.get(sessao);
  if (!cliente) return null;
  try {
    const contato = await cliente.getContactById(`${numero}@c.us`);
    return contato.pushname || contato.name || contato.shortName || null;
  } catch {
    return null;
  }
}

export async function baixarHistorico(sessao, numero, onProgresso) {
  const cliente = sessoes.get(sessao);
  if (!cliente) return;
  const numeroLimpo = normalizarNumero(numero);
  try {
    const chat = await cliente.getChatById(`${numeroLimpo}@c.us`);
    const pastaSessao = path.join(pastaDados, sessao);
    if (!fs.existsSync(pastaSessao)) fs.mkdirSync(pastaSessao, { recursive: true });
    const limit = 100;
    let mensagens = [];
    let lastId;
    const inicio = Date.now();
    let estimado = limit;
    while (true) {
      const opts = { limit };
      if (lastId) opts.before = lastId;
      const batch = await chat.fetchMessages(opts);
      if (!batch.length) break;
      mensagens = mensagens.concat(batch);
      lastId = batch[batch.length - 1].id._serialized;
      const progresso = mensagens.length / estimado;
      if (onProgresso) {
        const decorrido = (Date.now() - inicio) / 1000;
        const restante = progresso > 0 ? decorrido * (1 / progresso - 1) : 0;
        onProgresso({ progress: Math.min(progresso, 1), count: mensagens.length, remaining: restante });
      }
      if (batch.length < limit) break;
      estimado += limit;
    }
    const historico = mensagens
      .reverse()
      .map(m => ({
        de: m.fromMe ? 'empresa' : 'cliente',
        texto: m.body,
        hora: m.timestamp ? new Date(m.timestamp * 1000).toISOString() : new Date().toISOString()
      }));
    fs.writeFileSync(path.join(pastaSessao, `${numeroLimpo}.json`), JSON.stringify(historico, null, 2));
    const tempo = (Date.now() - inicio) / 1000;
    registrarHistorico(`Sessão ${sessao} número ${numeroLimpo}: ${historico.length} mensagens em ${tempo.toFixed(1)}s`);
    if (onProgresso) onProgresso({ progress: 1, count: historico.length, remaining: 0 });
    return historico.length;
  } catch (err) {
    registrarErro(`Falha ao baixar histórico de ${numeroLimpo}: ${err.message}`);
    registrarHistorico(`Sessão ${sessao} número ${numeroLimpo}: erro ${err.message}`);
    if (onProgresso) onProgresso({ progress: 1, count: 0, remaining: 0 });
  }
}

