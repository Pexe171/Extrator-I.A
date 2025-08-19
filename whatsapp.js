// Módulo responsável por gerenciar múltiplas sessões do WhatsApp
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { adicionarCliente } from './clientes.js';
import { registrarErro } from './logger.js';

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
const formatarData = d => d.toISOString().replace('T', ' ').slice(0,16);

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


  cliente.on('message_create', msg => {
    const numero = (msg.fromMe ? msg.to : msg.from).replace('@c.us', '');
    adicionarCliente(nome, numero);
    const arquivo = path.join(pastaSessao, `${numero}.json`);
    let dados = { cliente: `+${numero}`, mensagens: [] };
    if (fs.existsSync(arquivo)) {
      try {
        const existente = JSON.parse(fs.readFileSync(arquivo));
        if (Array.isArray(existente)) {
          dados.mensagens = existente;
        } else {
          dados = existente;
        }
      } catch {
        dados = { cliente: `+${numero}`, mensagens: [] };
      }
    }
    dados.cliente = dados.cliente && dados.cliente.startsWith('+') ? dados.cliente : `+${numero}`;
    dados.mensagens.push({
      de: msg.fromMe ? 'empresa' : 'cliente',
      texto: msg.body,
      hora: formatarData(msg.timestamp ? new Date(msg.timestamp * 1000) : new Date())
    });
    fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
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
