import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registrarErro } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pastaDados = path.join(__dirname, 'dados');

export function exportarParaCobrador(sessao, onProgress) {
  const pastaSessao = path.join(pastaDados, sessao);
  if (!fs.existsSync(pastaSessao)) {
    registrarErro(`Sessão inexistente: ${sessao}`);
    return { erro: 'Sessão desconectada.' };
  }

  const arquivos = fs.readdirSync(pastaSessao).filter(f => f.endsWith('.json'));
  if (arquivos.length === 0) {
    registrarErro(`Nenhum cliente encontrado na sessão ${sessao}`);
    return { erro: 'Nenhum cliente encontrado.' };
  }

  if (onProgress) onProgress(0);
  arquivos.forEach((arquivo, index) => {
    const numero = arquivo.replace('.json', '');
    const caminho = path.join(pastaSessao, arquivo);
    let conteudo;
    try { conteudo = JSON.parse(fs.readFileSync(caminho)); } catch { conteudo = null; }
    if (!conteudo) return;
    let dados;
    if (Array.isArray(conteudo)) {
      const mensagens = conteudo.map(m => ({
        de: m.de === `${numero}@c.us` ? 'cliente' : 'empresa',
        texto: m.corpo,
        hora: (m.data || '').replace('T', ' ').slice(0,16)
      }));
      dados = { cliente: `+${numero}`, mensagens };
    } else {
      dados = {
        cliente: conteudo.cliente && conteudo.cliente.startsWith('+') ? conteudo.cliente : `+${numero}`,
        mensagens: conteudo.mensagens || []
      };
    }
    fs.writeFileSync(caminho, JSON.stringify(dados, null, 2));
    if (onProgress) onProgress((index + 1) / arquivos.length);
  });

  return { sucesso: true };
}
