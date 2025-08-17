import express from 'express';
import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
import { fileURLToPath } from 'url';

const { Client, LocalAuth } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const clientsFile = path.join(__dirname, 'clientes.json');
const sessionsFile = path.join(__dirname, 'sessoes.json');
const dataDir = path.join(__dirname, 'dados');

function ensureFiles() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  if (!fs.existsSync(clientsFile)) fs.writeFileSync(clientsFile, '[]');
  if (!fs.existsSync(sessionsFile)) fs.writeFileSync(sessionsFile, '[]');
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

ensureFiles();

const sessions = new Map();

function createWAClient(nome) {
  const client = new Client({ authStrategy: new LocalAuth({ clientId: nome }) });

  client.on('qr', qr => {
    console.log(`QR para sessão ${nome}:`);
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log(`Sessão ${nome} pronta`);
  });

  client.on('message', msg => {
    const numero = msg.from.split('@')[0];
    const clientes = readJSON(clientsFile);
    if (!clientes.includes(numero)) return;
    const file = path.join(dataDir, `${numero}.json`);
    const historico = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : [];
    historico.push({
      body: msg.body,
      from: msg.from,
      to: msg.to,
      timestamp: new Date().toISOString()
    });
    fs.writeFileSync(file, JSON.stringify(historico, null, 2));
  });

  client.initialize();
  sessions.set(nome, client);
}

readJSON(sessionsFile).forEach(nome => createWAClient(nome));

app.use(express.json());

app.get('/sessoes', (req, res) => {
  res.json(readJSON(sessionsFile));
});

app.post('/sessao', (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const lista = readJSON(sessionsFile);
  if (lista.includes(nome)) return res.status(400).json({ erro: 'Sessão já existe' });
  lista.push(nome);
  writeJSON(sessionsFile, lista);
  createWAClient(nome);
  res.json({ status: 'sessão criada' });
});

app.get('/clientes', (req, res) => {
  res.json(readJSON(clientsFile));
});

app.post('/cliente', (req, res) => {
  const { numero } = req.body;
  if (!numero) return res.status(400).json({ erro: 'Número é obrigatório' });
  const lista = readJSON(clientsFile);
  if (!lista.includes(numero)) {
    lista.push(numero);
    writeJSON(clientsFile, lista);
  }
  res.json({ status: 'cliente adicionado' });
});

app.get('/conversas/:numero', (req, res) => {
  const numero = req.params.numero;
  const file = path.join(dataDir, `${numero}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ erro: 'Conversas não encontradas' });
  res.download(file, `${numero}.json`);
});

if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.use('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
