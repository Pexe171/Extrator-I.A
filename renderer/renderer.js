const { ipcRenderer } = require('electron');

const sessionInput = document.getElementById('session-name');
const createBtn = document.getElementById('create-session');
const sessionsList = document.getElementById('sessions');

const clientsList = document.getElementById('clients');
const clientNumberInput = document.getElementById('client-number');
const addClientBtn = document.getElementById('add-client');

const exportBtn = document.getElementById('export-chats');
const downloadStatus = document.getElementById('download-status');

const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');

const qrOverlay = document.getElementById('qr-overlay');
const qrImage = document.getElementById('qr-image');

const sessionStatuses = {};
qrOverlay.addEventListener('click', () => qrOverlay.classList.remove('mostrar'));

let sessaoSelecionada = null;
let clienteSelecionado = null;
let inicioExport = null;
let inicioDownload = null;

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
  anime({ targets: li, opacity: [0,1], translateY: [-10,0], duration: 300, easing: 'easeOutQuad' });
}

function selecionarCliente(numero, elemento) {
  clienteSelecionado = numero;
  document.querySelectorAll('#clients li').forEach(li => li.classList.remove('selecionado'));
  elemento.classList.add('selecionado');
  inicioDownload = Date.now();
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  downloadStatus.textContent = '';
  ipcRenderer.invoke('download-history', { sessao: sessaoSelecionada, numero });
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

exportBtn.addEventListener('click', async () => {
  if (!sessaoSelecionada) {
    alert('Selecione uma sessão.');
    return;
  }
  inicioExport = Date.now();
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  downloadStatus.textContent = '';
  const resposta = await ipcRenderer.invoke('export-chats', { sessao: sessaoSelecionada, numero: null, formato: 'json' });
  if (resposta && resposta.erro) alert(resposta.erro);
});

ipcRenderer.on('export-progress', (_e, progresso) => {
  progressContainer.style.display = 'block';
  const decorrido = (Date.now() - inicioExport) / 1000;
  const restante = progresso > 0 ? decorrido * (1 / progresso - 1) : 0;
  downloadStatus.textContent = progresso >= 1
    ? 'Download concluído'
    : `Tempo restante: ${restante.toFixed(1)}s`;
  anime({ targets: progressBar, width: `${progresso * 100}%`, duration: 200, easing: 'easeInOutQuad' });
  if (progresso >= 1) {
    setTimeout(() => {
      progressContainer.style.display = 'none';
      progressBar.style.width = '0%';
    }, 500);
  }
});

ipcRenderer.on('download-progress', (_e, { numero, progress, count, remaining }) => {
  if (numero !== clienteSelecionado) return;
  progressContainer.style.display = 'block';
  const texto = remaining > 0
    ? `Baixadas ${count} mensagens - restante ${remaining.toFixed(1)}s`
    : `Baixadas ${count} mensagens`;
  downloadStatus.textContent = texto;
  anime({ targets: progressBar, width: `${Math.min(progress,1) * 100}%`, duration: 200, easing: 'easeInOutQuad' });
  if (progress >= 1) {
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
  }
});
