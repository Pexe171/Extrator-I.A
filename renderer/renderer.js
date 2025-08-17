const { ipcRenderer } = require('electron');

// Sessão atualmente selecionada
let sessaoAtual = null;

// Elementos da interface
const listaSessoes = document.getElementById('sessionList');
const listaClientes = document.getElementById('clientList');
const botaoNovaSessao = document.getElementById('newSession');
const botaoAddCliente = document.getElementById('addClient');
const campoNovoCliente = document.getElementById('newClientInput');
const botaoExportar = document.getElementById('exportChats');

// Solicita lista inicial de sessões ao processo principal
ipcRenderer.invoke('get-sessions').then(sessoes => {
  sessoes.forEach(s => adicionarSessaoNaLista(s));
});

// Cria nova sessão a partir do nome informado
botaoNovaSessao.addEventListener('click', () => {
  const nome = prompt('Nome da sessão:');
  if (nome) {
    ipcRenderer.send('create-session', nome);
    adicionarSessaoNaLista(nome);
  }
});

// Adiciona novo cliente manualmente
botaoAddCliente.addEventListener('click', () => {
  const numero = campoNovoCliente.value.trim();
  if (numero && sessaoAtual) {
    ipcRenderer.send('add-client', { sessao: sessaoAtual, numero });
    campoNovoCliente.value = '';
  }
});

// Exporta conversas do cliente selecionado
botaoExportar.addEventListener('click', () => {
  const numero = prompt('Número do cliente para exportar:');
  const formato = prompt('Formato (json/txt):', 'json');
  if (numero) {
    ipcRenderer.send('export-chats', { numero, formato });
  }
});

// Atualiza status das sessões
ipcRenderer.on('session-status', (_e, { nome, status }) => {
  const item = document.querySelector(`li[data-sessao="${nome}"]`);
  if (item) item.textContent = `${nome} - ${status}`;
});

// Atualiza lista de clientes quando alterada
ipcRenderer.on('clients-updated', (_e, { sessao, clientes }) => {
  if (sessao === sessaoAtual) {
    renderizarClientes(clientes);
  }
});

// Adiciona sessão na interface e registra clique
function adicionarSessaoNaLista(nome) {
  const li = document.createElement('li');
  li.textContent = `${nome} - offline`;
  li.dataset.sessao = nome;
  li.addEventListener('click', () => {
    sessaoAtual = nome;
    ipcRenderer.invoke('get-clients', nome).then(renderizarClientes);
  });
  listaSessoes.appendChild(li);
}

// Renderiza lista de clientes
function renderizarClientes(clientes) {
  listaClientes.innerHTML = '';
  clientes.forEach(c => {
    const li = document.createElement('li');
    li.textContent = c;
    listaClientes.appendChild(li);
  });
}
