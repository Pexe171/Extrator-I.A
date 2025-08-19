import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registrarErro } from './logger.js';
import { obterClientes, normalizarNumero } from './clientes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pastaDados = path.join(__dirname, 'dados');

export function exportarConversas(sessao, numero, formato = 'json', onProgress) {
  const pastaSessao = path.join(pastaDados, sessao);
  if (!fs.existsSync(pastaSessao)) {
    registrarErro(`Sessão inexistente: ${sessao}`);
    return { erro: 'Sessão desconectada.' };
  }

  let numeros;
  if (numero) {
    numeros = [normalizarNumero(numero)];
  } else {
    numeros = obterClientes(sessao);
  }

  if (numeros.length === 0) {
    registrarErro(`Nenhum número para exportar na sessão ${sessao}`);
    return { erro: 'Nenhum número encontrado.' };
  }

  const resultado = [];
  let total = 0;
  if (onProgress) onProgress({ progress: 0, count: 0 });
  numeros.forEach((num, index) => {
    const arquivoJson = path.join(pastaSessao, `${num}.json`);
    if (!fs.existsSync(arquivoJson)) {
      return;
    }
    const historico = JSON.parse(fs.readFileSync(arquivoJson))
      .filter(m => m.texto && m.texto.trim())
      .slice(-1000);
    const registro = { cliente: `+${num}`, mensagens: historico };
    total += historico.length;
    resultado.push(registro);
    fs.writeFileSync(path.join(pastaSessao, `${num}-cobrador.json`), JSON.stringify(registro, null, 2));
    if (formato === 'txt') {
      const linhas = historico.map(m => `[${m.hora}] ${m.de}: ${m.texto}`).join('\n');
      fs.writeFileSync(path.join(pastaSessao, `${num}.txt`), linhas);
    }
    if (onProgress) {
      onProgress({ progress: (index + 1) / numeros.length, count: total });
    }
  });

  fs.writeFileSync(path.join(pastaSessao, 'export.json'), JSON.stringify(resultado, null, 2));
  if (onProgress) onProgress({ progress: 1, count: total });
  return { sucesso: true };
}
