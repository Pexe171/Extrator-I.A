const { ipcRenderer } = require('electron');

const sessionInput = document.getElementById('session-name');
const createBtn = document.getElementById('create-session');
const sessionsList = document.getElementById('sessions');

const clientsList = document.getElementById('clients');
const clientNumberInput = document.getElementById('client-number');
const addClientBtn = document.getElementById('add-client');
const clientSearch = document.getElementById('client-search');

const chatPreview = document.getElementById('chat-preview');
const exportCobradorBtn = document.getElementById('export-cobrador');

const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');

const qrOverlay = document.getElementById('qr-overlay');
const qrImage = document.getElementById('qr-image');

const sessionStatuses = {};
qrOverlay.addEventListener('click', () => qrOverlay.classList.remove('mostrar'));

let sessaoSelecionada = null;
let clienteSelecionado = null;

function addSession(nome) {
  const li = document.createElement('li');
  li.dataset.nome = nome;
  li.innerHTML = `<span class="indicador-status offline"></span><span class="nome">${nome}</span><button class="remover"><i class="fas fa-trash"></i></button>`;
  li.addEventListener('click', () => selecionarSessao(nome, li));
  const remover = li.querySelector('.remover');
  remover.addEventListener('click', e => {
    e.stopPropagation();
    ipcRenderer.send('remove-session', nome);
  });
  sessionsList.appendChild(li);
  sessionStatuses[nome] = 'offline';
  atualizarEstadoBotaoSessao();
  anime({ targets: li, opacity: [0,1], translateY: [-10,0], duration: 300, easing: 'easeOutQuad' });
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

function addClient(cliente) {
  const numero = typeof cliente === 'string' ? cliente : cliente.numero;
  const nome = typeof cliente === 'string' ? cliente : (cliente.nome || cliente.numero);
  const li = document.createElement('li');
  li.dataset.numero = numero;
  li.dataset.nome = nome;
  li.textContent = nome;
  li.addEventListener('click', () => selecionarCliente(numero, li));
  clientsList.appendChild(li);
  anime({ targets: li, opacity: [0,1], translateY: [-10,0], duration: 300, easing: 'easeOutQuad' });
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
        div.innerHTML = `[${m.hora}] <span class="de">${m.de}</span> ${m.texto}`;
        chatPreview.appendChild(div);
        anime({ targets: div, opacity: [0,1], translateY: [10,0], duration: 300, easing: 'easeOutQuad' });
      });
    });
}

function podeCriarSessao() {
  return Object.values(sessionStatuses).every(s => s === 'online');
}

function atualizarEstadoBotaoSessao() {
  const permitido = podeCriarSessao();
  createBtn.disabled = !permitido;
  sessionInput.disabled = !permitido;
}

createBtn.addEventListener('click', () => {
  if (!podeCriarSessao()) {
    alert('Conclua a configuração da sessão atual antes de adicionar outra.');
    return;
  }
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
    const nome = (li.dataset.nome || '').toLowerCase();
    const numero = li.dataset.numero || '';
    li.style.display = nome.includes(termo) || numero.includes(termo) ? '' : 'none';
  });
});

exportCobradorBtn.addEventListener('click', async () => {
  if (!sessaoSelecionada) {
    alert('Selecione uma sessão.');
    return;
  }
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  const resposta = await ipcRenderer.invoke('export-cobrador', { sessao: sessaoSelecionada });
  if (resposta && resposta.erro) alert(resposta.erro);
});

ipcRenderer.on('export-progress', (_e, progresso) => {
  progressContainer.style.display = 'block';
  anime({ targets: progressBar, width: `${progresso * 100}%`, duration: 200, easing: 'easeInOutQuad' });
  if (progresso >= 1) {
    setTimeout(() => {
      progressContainer.style.display = 'none';
      progressBar.style.width = '0%';
    }, 500);
  }
});

ipcRenderer.invoke('get-sessions').then(nomes => nomes.forEach(addSession));

ipcRenderer.on('session-status', (_e, { nome, status }) => {
  sessionStatuses[nome] = status;
  const li = document.querySelector(`li[data-nome="${nome}"]`);
  if (li) {
    const indicador = li.querySelector('.indicador-status');
    indicador.className = `indicador-status ${status}`;
    if (status === 'online') {
      qrOverlay.classList.remove('mostrar');
      ipcRenderer.send('sync-session', nome);
    }
  }
  atualizarEstadoBotaoSessao();
});

ipcRenderer.on('session-qr', (_e, { qr }) => {
  qrImage.src = qr;
  qrOverlay.classList.add('mostrar');
});

ipcRenderer.on('session-removed', (_e, nome) => {
  const li = document.querySelector(`li[data-nome="${nome}"]`);
  if (li) li.remove();
  delete sessionStatuses[nome];
  atualizarEstadoBotaoSessao();
  if (sessaoSelecionada === nome) {
    sessaoSelecionada = null;
    clientsList.innerHTML = '';
    chatPreview.innerHTML = '';
  }
});
