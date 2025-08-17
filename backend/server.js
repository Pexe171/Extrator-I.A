import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode-terminal';
import { Client, LocalAuth } from 'whatsapp-web.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const SESSIONS_FILE = path.join(__dirname, 'sessoes.json');
const CLIENTES_FILE = path.join(__dirname, 'clientes.json');
const DADOS_DIR = path.join(__dirname, 'dados');

if (!fs.existsSync(DADOS_DIR)) {
  fs.mkdirSync(DADOS_DIR, { recursive: true });
}

function loadJSON(file, defaultValue) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
    return defaultValue;
  }
  return JSON.parse(fs.readFileSync(file));
}

let sessionNames = loadJSON(SESSIONS_FILE, []);
let clientes = loadJSON(CLIENTES_FILE, []);
const sessions = {};

function createSession(nome) {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: nome })
  });

  client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log(`Sessão ${nome} pronta.`);
  });

  client.on('message', msg => {
    const numero = msg.from.replace('@c.us', '');
    const file = path.join(DADOS_DIR, `${numero}.json`);
    let historico = [];
    if (fs.existsSync(file)) {
      historico = JSON.parse(fs.readFileSync(file));
    }
    historico.push({
      corpo: msg.body,
      data: new Date().toISOString()
    });
    fs.writeFileSync(file, JSON.stringify(historico, null, 2));
  });

  client.initialize();
  sessions[nome] = client;
}

sessionNames.forEach(nome => {
  createSession(nome);
});

app.get('/sessoes', (req, res) => {
  res.json(sessionNames);
});

app.post('/sessao', (req, res) => {
  const { nome } = req.body;
  if (!nome || sessionNames.includes(nome)) {
    return res.status(400).json({ erro: 'Nome inválido ou já existente.' });
  }
  sessionNames.push(nome);
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionNames, null, 2));
  createSession(nome);
  res.json({ sucesso: true });
});

app.get('/clientes', (req, res) => {
  res.json(clientes);
});

app.post('/cliente', (req, res) => {
  const { numero } = req.body;
  if (!numero || clientes.includes(numero)) {
    return res.status(400).json({ erro: 'Número inválido ou já cadastrado.' });
  }
  clientes.push(numero);
  fs.writeFileSync(CLIENTES_FILE, JSON.stringify(clientes, null, 2));
  res.json({ sucesso: true });
});

app.get('/conversas/:numero', (req, res) => {
  const numero = req.params.numero;
  const file = path.join(DADOS_DIR, `${numero}.json`);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ erro: 'Histórico não encontrado.' });
  }
  res.download(file);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
