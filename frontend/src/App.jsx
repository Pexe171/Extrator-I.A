import { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:3001';

export default function App() {
  const [sessoes, setSessoes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [sessaoNome, setSessaoNome] = useState('');
  const [numeroCliente, setNumeroCliente] = useState('');
  const [numeroExport, setNumeroExport] = useState('');

  useEffect(() => {
    carregarSessoes();
    carregarClientes();
  }, []);

  async function carregarSessoes() {
    const res = await axios.get(`${API}/sessoes`);
    setSessoes(res.data);
  }

  async function carregarClientes() {
    const res = await axios.get(`${API}/clientes`);
    setClientes(res.data);
  }

  async function criarSessao() {
    if (!sessaoNome) return;
    await axios.post(`${API}/sessao`, { nome: sessaoNome });
    setSessaoNome('');
    carregarSessoes();
  }

  async function adicionarCliente() {
    if (!numeroCliente) return;
    await axios.post(`${API}/cliente`, { numero: numeroCliente });
    setNumeroCliente('');
    carregarClientes();
  }

  function exportar() {
    if (!numeroExport) return;
    window.open(`${API}/conversas/${numeroExport}`, '_blank');
  }

  return (
    <div className="min-h-screen p-4 grid grid-cols-2 gap-4">
      <div>
        <h2 className="text-xl mb-2">Sessões</h2>
        <ul className="mb-4">
          {sessoes.map(s => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-gray-800 p-2"
            placeholder="nome da sessão"
            value={sessaoNome}
            onChange={e => setSessaoNome(e.target.value)}
          />
          <button className="bg-blue-600 px-4" onClick={criarSessao}>Nova</button>
        </div>
      </div>
      <div>
        <h2 className="text-xl mb-2">Clientes</h2>
        <ul className="mb-4">
          {clientes.map(c => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 bg-gray-800 p-2"
            placeholder="número do cliente"
            value={numeroCliente}
            onChange={e => setNumeroCliente(e.target.value)}
          />
          <button className="bg-blue-600 px-4" onClick={adicionarCliente}>Adicionar</button>
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-gray-800 p-2"
            placeholder="número para exportar"
            value={numeroExport}
            onChange={e => setNumeroExport(e.target.value)}
          />
          <button className="bg-green-600 px-4" onClick={exportar}>Exportar</button>
        </div>
      </div>
    </div>
  );
}
