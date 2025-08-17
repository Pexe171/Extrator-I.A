import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registrarErro } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pastaDados = path.join(__dirname, 'dados');

export function exportarConversas(sessao, numero, formato = 'json', onProgress) {
  const pastaSessao = path.join(pastaDados, sessao);
  if (!fs.existsSync(pastaSessao)) {
    registrarErro(`Sessão inexistente: ${sessao}`);
    return { erro: 'Sessão desconectada.' };
  }

  const numeros = numero
    ? [numero]
    : fs.readdirSync(pastaSessao)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));

  if (numeros.length === 0) {
    registrarErro(`Número inválido solicitado na sessão ${sessao}: ${numero}`);
    return { erro: 'Número inválido.' };
  }

  if (onProgress) onProgress(0);
  numeros.forEach((num, index) => {
    const arquivoJson = path.join(pastaSessao, `${num}.json`);
    if (!fs.existsSync(arquivoJson)) return;
    if (formato === 'txt') {
      const historico = JSON.parse(fs.readFileSync(arquivoJson));
      const linhas = historico.map(m => `[${m.data}] ${m.de}: ${m.corpo}`).join('\n');
      fs.writeFileSync(path.join(pastaSessao, `${num}.txt`), linhas);
    }
    if (onProgress) onProgress((index + 1) / numeros.length);
  });

  return { sucesso: true };
}
