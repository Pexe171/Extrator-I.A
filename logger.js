import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pastaLogs = path.join(__dirname, 'logs');

if (!fs.existsSync(pastaLogs)) fs.mkdirSync(pastaLogs, { recursive: true });

export function registrarErro(mensagem) {
  const linha = `[${new Date().toISOString()}] ${mensagem}\n`;
  fs.appendFileSync(path.join(pastaLogs, 'erros.log'), linha);
}
