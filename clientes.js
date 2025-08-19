import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const arquivoClientes = path.join(__dirname, 'clientes.json');

export function lerClientes() {
  if (!fs.existsSync(arquivoClientes)) return {};
  return JSON.parse(fs.readFileSync(arquivoClientes));
}

export function salvarClientes(dados) {
  fs.writeFileSync(arquivoClientes, JSON.stringify(dados, null, 2));
}

export function adicionarCliente(sessao, numero) {
  const dados = lerClientes();
  if (!dados[sessao]) dados[sessao] = [];
  if (numero.includes('@g.us')) return dados[sessao];
  if (!dados[sessao].includes(numero)) dados[sessao].push(numero);
  salvarClientes(dados);
  return dados[sessao];
}

export function obterClientes(sessao) {
  const dados = lerClientes();
  return (dados[sessao] || []).filter(n => !n.includes('@g.us'));
}
