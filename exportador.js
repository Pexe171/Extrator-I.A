import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pastaDados = path.join(__dirname, 'dados');

export function exportarConversas(sessao, numero, formato = 'json') {
  const pastaSessao = path.join(pastaDados, sessao);
  const arquivoJson = path.join(pastaSessao, `${numero}.json`);
  if (!fs.existsSync(arquivoJson)) return;

  if (formato === 'txt') {
    const historico = JSON.parse(fs.readFileSync(arquivoJson));
    const linhas = historico.map(m => `[${m.data}] ${m.de}: ${m.corpo}`).join('\n');
    fs.writeFileSync(path.join(pastaSessao, `${numero}.txt`), linhas);
  }
}
