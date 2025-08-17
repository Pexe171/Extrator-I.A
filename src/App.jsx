import { useState, useEffect } from 'react';

export default function App() {
  const [sessoes, setSessoes] = useState([]);
  const [novaSessao, setNovaSessao] = useState('');
  const [clientes, setClientes] = useState([]);
  const [novoCliente, setNovoCliente] = useState('');

  useEffect(() => {
    fetch('/sessoes').then(r => r.json()).then(setSessoes);
    fetch('/clientes').then(r => r.json()).then(setClientes);
  }, []);

  const adicionarSessao = async () => {
    if (!novaSessao) return;
    await fetch('/sessao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: novaSessao })
    });
    setSessoes([...sessoes, novaSessao]);
    setNovaSessao('');
  };

  const adicionarCliente = async () => {
    if (!novoCliente) return;
    await fetch('/cliente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: novoCliente })
    });
    setClientes([...clientes, novoCliente]);
    setNovoCliente('');
  };

  const exportar = (numero) => {
    window.location.href = `/conversas/${numero}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
      <h1 className="text-2xl mb-4">Extrator-I.A</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl mb-2">Sessões</h2>
          <ul className="mb-2">
            {sessoes.map(s => <li key={s}>{s}</li>)}
          </ul>
          <div className="flex gap-2">
            <input className="flex-1 p-2 bg-gray-800" value={novaSessao} onChange={e => setNovaSessao(e.target.value)} placeholder="Nome da sessão" />
            <button className="bg-green-600 px-4" onClick={adicionarSessao}>+</button>
          </div>
        </div>
        <div>
          <h2 className="text-xl mb-2">Clientes</h2>
          <ul className="mb-2">
            {clientes.map(c => (
              <li key={c} className="flex justify-between items-center">
                <span>{c}</span>
                <button className="text-sm underline" onClick={() => exportar(c)}>Exportar</button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input className="flex-1 p-2 bg-gray-800" value={novoCliente} onChange={e => setNovoCliente(e.target.value)} placeholder="Número do cliente" />
            <button className="bg-blue-600 px-4" onClick={adicionarCliente}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}
