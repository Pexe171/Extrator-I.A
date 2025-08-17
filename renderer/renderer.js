const { ipcRenderer } = require('electron');
const QRCode = require('qrcode');

const sessionInput = document.getElementById('session-name');
const createBtn = document.getElementById('create-session');
const sessionsList = document.getElementById('sessions');

const clientsList = document.getElementById('clients');
const clientNumberInput = document.getElementById('client-number');
const addClientBtn = document.getElementById('add-client');
const clientSearch = document.getElementById('client-search');

const chatPreview = document.getElementById('chat-preview');
const exportBtn = document.getElementById('export-chats');

let sessaoSelecionada = null;
let clienteSelecionado = null;

function addSession(nome) {
  const li = document.createElement('li');
  li.dataset.nome = nome;
  li.innerHTML = `<span class="indicador-status offline"></span><span class="nome">${nome}</span><div class="qr"></div>`;
  li.addEventListener('click', () => selecionarSessao(nome, li));
  sessionsList.appendChild(li);
}

function selecionarSessao(nome, elemento) {
  sessaoSelecionada = nome;
  clienteSelecionado = null;
  document.querySelectorAll('#sessions li').forEach(li => li.classList.remove('selecionado'));
  elemento.classList.add('selecionado');
  clientsList.innerHTML = '';
  chatPreview.innerHTML = '';
  ipcRenderer.invoke('get-clients', nome).then(clientes => {
    clientes.forEach(addClient);
  });
}

function addClient(numero) {
  const li = document.createElement('li');
  li.dataset.numero = numero;
  li.textContent = numero;
  li.addEventListener('click', () => selecionarCliente(numero, li));
  clientsList.appendChild(li);
}

function selecionarCliente(numero, elemento) {
  clienteSelecionado = numero;
  document.querySelectorAll('#clients li').forEach(li => li.classList.remove('selecionado'));
  elemento.classList.add('selecionado');
  carregarHistorico();
}

function carregarHistorico() {
  if (!sessaoSelecionada || !clienteSelecionado) return;
  ipcRenderer.invoke('get-history', { sessao: sessaoSelecionada, numero: clienteSelecionado })
    .then(mensagens => {
      chatPreview.innerHTML = '';
      mensagens.forEach(m => {
        const div = document.createElement('div');
        div.classList.add('mensagem');
        div.innerHTML = `[${m.data}] <span class="de">${m.de}</span> ${m.corpo}`;
        chatPreview.appendChild(div);
      });
    });
}

createBtn.addEventListener('click', () => {
  const nome = sessionInput.value.trim();
  if (nome) {
    ipcRenderer.send('create-session', nome);
    if (!document.querySelector(`li[data-nome="${nome}"]`)) {
      addSession(nome);
    }
    sessionInput.value = '';
  }
});

addClientBtn.addEventListener('click', () => {
  const numero = clientNumberInput.value.trim();
  if (!sessaoSelecionada || !numero) return;
  ipcRenderer.send('add-client', { sessao: sessaoSelecionada, numero });
  clientNumberInput.value = '';
});

ipcRenderer.on('clients-updated', (_e, { sessao, clientes }) => {
  if (sessao !== sessaoSelecionada) return;
  clientsList.innerHTML = '';
  clientes.forEach(addClient);
});

clientSearch.addEventListener('input', () => {
  const termo = clientSearch.value.toLowerCase();
  document.querySelectorAll('#clients li').forEach(li => {
    li.style.display = li.textContent.toLowerCase().includes(termo) ? '' : 'none';
  });
});

exportBtn.addEventListener('click', async () => {
  if (!sessaoSelecionada) {
    alert('Selecione uma sessão.');
    return;
  }
  const cliente = prompt('Número do cliente ou "todos"');
  if (cliente === null) return;
  let numero = cliente.trim();
  const formatoInput = prompt('Formato (json/txt)', 'json');
  const formato = formatoInput === 'txt' ? 'txt' : 'json';
  if (numero !== 'todos' && !/^\d+$/.test(numero)) {
    alert('Número inválido.');
    return;
  }
  const resposta = await ipcRenderer.invoke('export-chats', { sessao: sessaoSelecionada, numero: numero === 'todos' ? null : numero, formato });
  if (resposta && resposta.erro) alert(resposta.erro);
});

ipcRenderer.invoke('get-sessions').then(nomes => nomes.forEach(addSession));

ipcRenderer.on('session-status', (_e, { nome, status }) => {
  const li = document.querySelector(`li[data-nome="${nome}"]`);
  if (li) {
    const indicador = li.querySelector('.indicador-status');
    indicador.className = `indicador-status ${status}`;
    if (status === 'online') {
      li.classList.remove('qr-ativo');
      const qrDiv = li.querySelector('.qr');
      qrDiv.innerHTML = '';
    }
  }
});

ipcRenderer.on('session-qr', (_e, { nome, qr }) => {
  const li = document.querySelector(`li[data-nome="${nome}"]`);
  if (li) {
    li.classList.add('qr-ativo');
    const qrDiv = li.querySelector('.qr');
    QRCode.toDataURL(qr, (err, url) => {
      if (err) return;
      const img = document.createElement('img');
      img.src = url;
      qrDiv.innerHTML = '';
      qrDiv.appendChild(img);
    });
  }
});

ipcRenderer.on('session-removed', (_e, nome) => {
  const li = document.querySelector(`li[data-nome="${nome}"]`);
  if (li) li.remove();
  if (sessaoSelecionada === nome) {
    sessaoSelecionada = null;
    clientsList.innerHTML = '';
    chatPreview.innerHTML = '';
  }
});
