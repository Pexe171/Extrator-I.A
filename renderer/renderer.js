const { ipcRenderer } = require('electron');
const QRCode = require('qrcode');

const sessionInput = document.getElementById('session-name');
const createBtn = document.getElementById('create-session');
const sessionsList = document.getElementById('sessions');

function addSession(nome) {
  const li = document.createElement('li');
  li.dataset.nome = nome;
  li.innerHTML = `<strong>${nome}</strong> - <span class="status offline">offline</span> <button class="remove">Desconectar</button> <button class="export">Exportar</button><div class="qr"></div>`;
  li.querySelector('.remove').addEventListener('click', () => {
    ipcRenderer.send('remove-session', nome);
  });
  li.querySelector('.export').addEventListener('click', async () => {
    const status = li.querySelector('.status').textContent;
    if (status !== 'online') {
      alert('Sessão desconectada.');
      return;
    }
    const cliente = prompt('Número do cliente ou "todos"');
    if (!cliente) return;
    let numero = cliente.trim();
    const formatoInput = prompt('Formato (json/txt)', 'json');
    const formato = formatoInput === 'txt' ? 'txt' : 'json';
    if (numero !== 'todos' && !/^\d+$/.test(numero)) {
      alert('Número inválido.');
      return;
    }
    const resposta = await ipcRenderer.invoke('export-chats', { sessao: nome, numero: numero === 'todos' ? null : numero, formato });
    if (resposta && resposta.erro) alert(resposta.erro);
  });
  sessionsList.appendChild(li);
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

ipcRenderer.invoke('get-sessions').then(nomes => {
  nomes.forEach(addSession);
});

ipcRenderer.on('session-status', (_e, { nome, status }) => {
  const li = document.querySelector(`li[data-nome="${nome}"]`);
  if (li) {
    const statusSpan = li.querySelector('.status');
    statusSpan.textContent = status;
    statusSpan.className = `status ${status}`;
    if (status === 'online') {
      const qrDiv = li.querySelector('.qr');
      qrDiv.innerHTML = '';
    }
  }
});

ipcRenderer.on('session-qr', (_e, { nome, qr }) => {
  const li = document.querySelector(`li[data-nome="${nome}"]`);
  if (li) {
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
});

