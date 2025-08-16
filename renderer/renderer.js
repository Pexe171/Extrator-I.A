// renderer.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos ---
    const navLinks = {
        whatsappStatus: document.getElementById('nav-whatsapp-status'),
        clients: document.getElementById('nav-clients'),
        addClient: document.getElementById('nav-add-client'),
        bulkMessage: document.getElementById('nav-bulk-message'),
        settings: document.getElementById('nav-settings')
    };
    const views = {
        whatsappStatus: document.getElementById('view-whatsapp-status'),
        clients: document.getElementById('view-clients'),
        addClient: document.getElementById('view-add-client'),
        bulkMessage: document.getElementById('view-bulk-message'),
        settings: document.getElementById('view-settings')
    };

    // --- Contas WhatsApp ---
    const whatsappAccountsListEl = document.getElementById('whatsapp-accounts-list');
    const btnAddWhatsAppAccount = document.getElementById('btn-add-whatsapp-account');

    // --- Clientes ---
    const clientForm = document.getElementById('client-form');
    const clientIdField = document.getElementById('client-id');
    const clientNameField = document.getElementById('client-name');
    const clientPhoneField = document.getElementById('client-phone');
    const clientWhatsAppAccountSelect = document.getElementById('client-whatsapp-account');
    const purchaseDateField = document.getElementById('purchase-date');
    const validityDaysField = document.getElementById('validity-days');
    const calculatedDueDateField = document.getElementById('calculated-due-date');
    const btnClearForm = document.getElementById('btn-clear-form');
    const formTitle = document.getElementById('form-title');
    const clientsListTableBody = document.getElementById('clients-list');
    const searchClientField = document.getElementById('search-client');
    const btnForceCharge = document.getElementById('btn-force-charge');

    // --- Envio em Massa ---
    const bulkMessageContainer = document.getElementById('view-bulk-message');

    // --- Configurações ---
    const scheduleTime1Input = document.getElementById('schedule-time-1');
    const scheduleTime2Input = document.getElementById('schedule-time-2');
    const btnSaveScheduleSettings = document.getElementById('btn-save-schedule-settings');
    const scheduleSettingsStatusEl = document.getElementById('schedule-settings-status');

    // --- Modal ---
    const modalOverlay = document.getElementById('custom-modal-overlay');
    
    // --- Variáveis de Estado ---
    let clientsMap = new Map();
    let whatsappAccountsMap = new Map();
    let currentModalConfirmCallback = null;

    // --- Funções de Modal ---
    function showModal(title, message, type = 'info', onConfirm = null) {
        modalOverlay.innerHTML = `
            <div class="modal-content">
                <h3 class="modal-title-text">${title}</h3>
                <p class="modal-message-text">${message.replace(/\n/g, '<br>')}</p>
                <div class="modal-actions">
                    <button id="modal-btn-confirm" class="btn-modal btn-modal-confirm" style="display: ${type === 'confirm' ? 'inline-block' : 'none'}">Sim</button>
                    <button id="modal-btn-cancel" class="btn-modal btn-modal-cancel" style="display: ${type === 'confirm' ? 'inline-block' : 'none'}">Não</button>
                    <button id="modal-btn-ok" class="btn-modal btn-modal-ok" style="display: ${type !== 'confirm' ? 'inline-block' : 'none'}">OK</button>
                </div>
            </div>
        `;
        currentModalConfirmCallback = onConfirm;
        document.getElementById('modal-btn-confirm').addEventListener('click', () => { if (currentModalConfirmCallback) currentModalConfirmCallback(); hideModal(); });
        document.getElementById('modal-btn-cancel').addEventListener('click', hideModal);
        document.getElementById('modal-btn-ok').addEventListener('click', () => { if (currentModalConfirmCallback) currentModalConfirmCallback(); hideModal(); });
        modalOverlay.classList.add('visible');
    }
    
    function showInputModal(title, message, placeholder, onConfirm) {
        modalOverlay.innerHTML = `
            <div class="modal-content">
                <h3 class="modal-title-text">${title}</h3>
                <p class="modal-message-text">${message}</p>
                <input type="text" id="modal-input-field" class="modal-input" placeholder="${placeholder}">
                <div class="modal-actions">
                    <button id="modal-input-confirm" class="btn-modal btn-modal-confirm">Confirmar</button>
                    <button id="modal-input-cancel" class="btn-modal btn-modal-cancel">Cancelar</button>
                </div>
            </div>
        `;
        const inputField = document.getElementById('modal-input-field');
        inputField.focus();
        document.getElementById('modal-input-confirm').addEventListener('click', () => {
            const value = inputField.value;
            if (value && value.trim() !== '') {
                onConfirm(value.trim());
                hideModal();
            }
        });
        inputField.addEventListener('keydown', (e) => { if (e.key === 'Enter') { document.getElementById('modal-input-confirm').click(); } });
        document.getElementById('modal-input-cancel').addEventListener('click', hideModal);
        modalOverlay.classList.add('visible');
    }

    function hideModal() {
        modalOverlay.classList.remove('visible');
        modalOverlay.innerHTML = '';
    }

    // --- Funções de Navegação e Formato ---
    function showView(viewId) {
        Object.values(views).forEach(v => v.classList.add('hidden'));
        if (views[viewId]) views[viewId].classList.remove('hidden');
        Object.values(navLinks).forEach(l => l.classList.remove('active'));
        if (navLinks[viewId]) navLinks[viewId].classList.add('active');
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('pt-BR');
    }
    
    function getClientStatus(dueDateString) {
        if (!dueDateString) return { text: 'N/A', className: '' };
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dueDate = new Date(dueDateString + 'T00:00:00');
        if (isNaN(dueDate.getTime())) return { text: 'Inválida', className: 'status-unknown' };
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { text: 'Vencido', className: 'status-expired' };
        if (diffDays === 0) return { text: 'Vence Hoje', className: 'status-warning' };
        return { text: 'Ativo', className: 'status-active' };
    }

    // --- Lógica de Contas WhatsApp ---
    async function loadAndRenderWhatsAppAccounts() {
        const accounts = await window.electronAPI.getWhatsAppAccounts();
        whatsappAccountsMap.clear();
        accounts.forEach(acc => whatsappAccountsMap.set(acc.id, acc));
        renderWhatsAppAccounts();
        populateWhatsAppAccountDropdown();
        renderBulkMessageUI();
    }

    function renderWhatsAppAccounts() {
        whatsappAccountsListEl.innerHTML = '';
        if (whatsappAccountsMap.size === 0) {
            whatsappAccountsListEl.innerHTML = `<p class="empty-list-message">Nenhuma conta de WhatsApp adicionada.</p>`;
            return;
        }

        whatsappAccountsMap.forEach(account => {
            const accountDiv = document.createElement('div');
            accountDiv.className = `account-item status-${account.status || 'disconnected'}`;
            accountDiv.dataset.accountId = account.id;

            let statusText = 'Desconectado';
            let statusIndicator = '<i class="fas fa-times-circle status-icon disconnected"></i>';
            if (account.status === 'qr') { statusText = 'Aguardando QR Code'; statusIndicator = '<i class="fas fa-qrcode status-icon qr"></i>'; }
            if (account.status === 'ready') { statusText = 'Conectado'; statusIndicator = '<i class="fas fa-check-circle status-icon ready"></i>'; }
            if (account.status === 'initializing') { statusText = 'Inicializando...'; statusIndicator = '<i class="fas fa-circle-notch fa-spin status-icon initializing"></i>'; }
            
            let contactableCount = 0;
            clientsMap.forEach(client => {
                if(client.contactableBy && client.contactableBy.includes(account.id)) {
                    contactableCount++;
                }
            });

            accountDiv.innerHTML = `
                <div class="account-header">
                    <strong class="account-name">${account.name}</strong>
                    <div class="account-status">${statusIndicator}<span>${statusText}</span></div>
                </div>
                <div class="account-body">
                    <div class="qr-code-container" id="qr-container-${account.id}"></div>
                    <div class="account-stats ${account.status === 'ready' ? '' : 'hidden'}">
                        <p><strong>${contactableCount}</strong> de <strong>${clientsMap.size}</strong> clientes são contactáveis por esta conta.</p>
                        <button class="btn-revalidate" data-action="revalidate" title="Forçar atualização da lista de contactos"><i class="fas fa-sync"></i> Atualizar</button>
                    </div>
                </div>
                <div class="account-actions">
                    <button class="btn-connect" data-action="connect" ${account.status === 'ready' || account.status === 'initializing' ? 'disabled' : ''}><i class="fas fa-link"></i> Conectar</button>
                    <button class="btn-disconnect btn-danger" data-action="disconnect" ${account.status !== 'ready' ? 'disabled' : ''}><i class="fas fa-unlink"></i> Desconectar</button>
                    <button class="btn-rename" data-action="rename"><i class="fas fa-pencil-alt"></i> Renomear</button>
                    <button class="btn-delete-account btn-danger" data-action="delete"><i class="fas fa-trash"></i> Remover</button>
                </div>
            `;
            whatsappAccountsListEl.appendChild(accountDiv);
        });
    }

    // --- Lógica de Clientes ---
    async function loadClients() {
        const clients = await window.electronAPI.getClients();
        clientsMap.clear();
        clients.sort((a, b) => a.name.localeCompare(b.name));
        clients.forEach(client => clientsMap.set(String(client.id), client));
        renderClientsTable(Array.from(clientsMap.values()));
        renderWhatsAppAccounts();
    }

    function renderClientsTable(clients) {
        clientsListTableBody.innerHTML = '';
        if (clients.length === 0) {
            clientsListTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Nenhum cliente cadastrado.</td></tr>`;
            return;
        }
        clients.forEach(client => {
            const row = clientsListTableBody.insertRow();
            row.dataset.clientId = client.id;
            const status = getClientStatus(client.dueDate);
            const account = whatsappAccountsMap.get(client.whatsappAccountId);
            const accountName = account ? account.name : 'Nenhuma';
            const isContactable = client.contactableBy && client.contactableBy.includes(client.whatsappAccountId);
            const contactableIcon = isContactable 
                ? `<i class="fas fa-check-circle contactable" title="Este cliente PODE receber mensagens da conta ${accountName}."></i>`
                : `<i class="fas fa-times-circle not-contactable" title="Este cliente NÃO PODE receber mensagens. Conecte a conta ${accountName} e atualize a validação."></i>`;

            row.innerHTML = `
                <td>${client.name} ${contactableIcon}</td>
                <td>${client.phone}</td>
                <td>${accountName}</td>
                <td>${formatDate(client.purchaseDate)}</td>
                <td>${formatDate(client.dueDate)}</td>
                <td class="${status.className}">${status.text}</td>
                <td>
                    <button class="edit-btn" data-action="edit">Editar</button>
                    <button class="delete-btn" data-action="delete">Excluir</button>
                </td>
            `;
        });
    }

    function populateWhatsAppAccountDropdown() {
        const currentValue = clientWhatsAppAccountSelect.value;
        clientWhatsAppAccountSelect.innerHTML = '<option value="" disabled>-- Selecione uma conta --</option>';
        let hasReadyAccounts = false;
        whatsappAccountsMap.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.name} ${account.status !== 'ready' ? '(Desconectada)' : ''}`;
            if (account.status !== 'ready') { option.disabled = true; } else { hasReadyAccounts = true; }
            clientWhatsAppAccountSelect.appendChild(option);
        });
        clientWhatsAppAccountSelect.value = currentValue;
        if (!hasReadyAccounts) { clientWhatsAppAccountSelect.innerHTML = '<option value="" disabled selected>Nenhuma conta conectada</option>'; } 
        else if (!clientWhatsAppAccountSelect.value) { clientWhatsAppAccountSelect.value = ""; }
    }
    
    function populateFormForEdit(client) {
        formTitle.textContent = 'Editar Cliente';
        clientIdField.value = client.id;
        clientNameField.value = client.name;
        clientPhoneField.value = client.phone;
        purchaseDateField.value = client.purchaseDate;
        validityDaysField.value = client.validityDays;
        populateWhatsAppAccountDropdown();
        clientWhatsAppAccountSelect.value = client.whatsappAccountId;
        calculateDueDate();
        btnClearForm.style.display = 'inline-block';
        showView('addClient');
    }

    const calculateDueDate = () => {
        const pd = purchaseDateField.value;
        const vd = parseInt(validityDaysField.value, 10);
        if (pd && !isNaN(vd)) {
            const d = new Date(pd);
            d.setUTCDate(d.getUTCDate() + vd);
            const dueDateISO = d.toISOString().split('T')[0];
            calculatedDueDateField.textContent = formatDate(dueDateISO);
            return dueDateISO;
        }
        calculatedDueDateField.textContent = '---';
        return null;
    };

    const clearForm = () => {
        clientForm.reset();
        clientIdField.value = '';
        calculateDueDate();
        populateWhatsAppAccountDropdown();
        btnClearForm.style.display = 'none';
        formTitle.textContent = 'Adicionar Cliente';
    };

    async function deleteClient(id, name) {
        showModal('Confirmar Exclusão', `Tem a certeza que deseja excluir o cliente "${name}"?`, 'confirm', async () => {
            const result = await window.electronAPI.deleteClient(id);
            showModal(result.success ? 'Sucesso' : 'Erro', result.message, 'info', loadClients);
        });
    }
    
    // --- Lógica de Envio em Massa ---
    function renderBulkMessageUI() {
        const readyAccounts = [...whatsappAccountsMap.values()].filter(acc => acc.status === 'ready');
        let optionsHtml = '<option value="">-- Selecione a conta de envio --</option>';
        readyAccounts.forEach(acc => { optionsHtml += `<option value="${acc.id}">${acc.name}</option>`; });

        bulkMessageContainer.innerHTML = `
            <div class="bulk-message-container content-card">
                <h2>Enviar Mensagem em Massa</h2>
                <div>
                    <label for="bulk-account-select">Enviar a partir da conta:</label>
                    <select id="bulk-account-select">${optionsHtml}</select>
                    <small>A mensagem será enviada para todos os clientes VÁLIDOS desta conta.</small>
                </div>
                <div>
                    <label for="bulk-message-text">Mensagem:</label>
                    <textarea id="bulk-message-text" rows="4" placeholder="Use {cliente_nome} para personalizar."></textarea>
                </div>
                <button id="btn-send-bulk-message" class="btn-primary-alt">Enviar para Clientes da Conta</button>
                <div id="bulk-message-status" style="margin-top: 10px;"></div>
            </div>`;

        const sendButton = document.getElementById('btn-send-bulk-message');
        if (sendButton) { sendButton.addEventListener('click', handleSendBulkMessage); }
    }
    
    async function handleSendBulkMessage() {
        const accountId = document.getElementById('bulk-account-select').value;
        const text = document.getElementById('bulk-message-text').value;
        const statusEl = document.getElementById('bulk-message-status');

        if (!accountId || !text) {
            showModal('Erro', 'Por favor, selecione uma conta e escreva uma mensagem.', 'error');
            return;
        }

        statusEl.textContent = 'A preparar envio...';
        const result = await window.electronAPI.sendBulkMessage(accountId, text);
        statusEl.textContent = result.message;
    }

    // --- Lógica de Configurações ---
    async function loadScheduleSettings() {
        const settings = await window.electronAPI.getScheduleSettings();
        if (settings) {
            scheduleTime1Input.value = settings.time1 || '10:00';
            scheduleTime2Input.value = settings.time2 || '16:00';
        }
    }

    // --- Inicialização ---
    async function initializeApp() {
        // Navegação
        Object.keys(navLinks).forEach(key => {
            navLinks[key].addEventListener('click', (e) => {
                e.preventDefault();
                showView(key);
                if (key === 'settings') loadScheduleSettings();
                if (key === 'addClient') clearForm();
            });
        });
        
        // Listeners de Formulários e Ações
        clientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clientData = {
                id: clientIdField.value || String(Date.now()),
                name: clientNameField.value, phone: clientPhoneField.value,
                whatsappAccountId: clientWhatsAppAccountSelect.value,
                purchaseDate: purchaseDateField.value,
                validityDays: parseInt(validityDaysField.value, 10),
                dueDate: calculateDueDate(),
                contactableBy: []
            };
            const result = clientIdField.value 
                ? await window.electronAPI.updateClient(clientData)
                : await window.electronAPI.addClient(clientData);

            if (result.success) {
                showModal('Sucesso', result.message, 'success', loadClients);
                showView('clients');
            } else {
                showModal('Erro', result.message, 'error');
            }
        });

        btnClearForm.addEventListener('click', clearForm);

        clientsListTableBody.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const action = button.dataset.action;
            const row = button.closest('tr');
            if (!action || !row) return;
            const clientId = row.dataset.clientId;
            const client = clientsMap.get(String(clientId));
            if (!client) return;
            if (action === 'edit') populateFormForEdit(client);
            if (action === 'delete') deleteClient(client.id, client.name);
        });

        btnAddWhatsAppAccount.addEventListener('click', () => {
            showInputModal('Adicionar Nova Conta', 'Digite um nome para identificar esta conta (ex: Vendas, Suporte).', 'Nome da conta',
                async (newName) => {
                    await window.electronAPI.addWhatsAppAccount(newName);
                    loadAndRenderWhatsAppAccounts();
                }
            );
        });
        
        whatsappAccountsListEl.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const accountItem = button.closest('.account-item');
            const accountId = accountItem.dataset.accountId;
            const action = button.dataset.action;
            
            if (action === 'connect') {
                button.textContent = 'Aguarde...'; button.disabled = true;
                window.electronAPI.requestQRCode(accountId);
            } else if (action === 'disconnect') {
                await window.electronAPI.disconnectWhatsApp(accountId);
            } else if (action === 'revalidate') {
                showModal('Aguarde', 'A atualizar a lista de contactos para esta conta...', 'info');
                const result = await window.electronAPI.forceValidation(accountId);
                showModal(result.success ? 'Sucesso' : 'Erro', result.message, 'info');
            } else if (action === 'delete') {
                showModal('Confirmar Exclusão', 'Tem a certeza?', 'confirm', async () => {
                    await window.electronAPI.removeWhatsAppAccount(accountId);
                    loadAndRenderWhatsAppAccounts();
                });
            } else if (action === 'rename') {
                 const oldName = whatsappAccountsMap.get(accountId)?.name || '';
                 showInputModal('Renomear Conta', `Novo nome para "${oldName}":`, oldName, async (newName) => {
                    await window.electronAPI.renameWhatsAppAccount(accountId, newName);
                    loadAndRenderWhatsAppAccounts();
                 });
            }
        });
        
        btnForceCharge.addEventListener('click', async () => {
            showModal('A Processar...', 'A verificar e enviar cobranças para clientes vencidos e contactáveis...', 'info');
            const result = await window.electronAPI.forceChargeDueClients();
            showModal('Processo Concluído', result.message, 'info');
        });

        btnSaveScheduleSettings.addEventListener('click', async () => {
            const settings = { time1: scheduleTime1Input.value, time2: scheduleTime2Input.value };
            const result = await window.electronAPI.saveScheduleSettings(settings);
            scheduleSettingsStatusEl.textContent = result.success ? 'Horários atualizados!' : 'Erro ao guardar.';
            scheduleSettingsStatusEl.className = `settings-status ${result.success ? 'alert-success' : 'alert-danger'}`;
            setTimeout(() => { scheduleSettingsStatusEl.textContent = ''; scheduleSettingsStatusEl.className = 'settings-status'; }, 4000);
        });
        
        searchClientField.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const allClients = Array.from(clientsMap.values());
            if (!searchTerm) { renderClientsTable(allClients); return; }
            const filteredClients = allClients.filter(client => client.name.toLowerCase().includes(searchTerm) || client.phone.includes(searchTerm));
            renderClientsTable(filteredClients);
        });

        // Listeners do Main Process
        window.electronAPI.onWhatsAppStateChange(() => { loadAndRenderWhatsAppAccounts(); });
        window.electronAPI.onWhatsAppQRCode((accountId, qr) => {
            const qrContainer = document.getElementById(`qr-container-${accountId}`);
            if (qrContainer) { qrContainer.innerHTML = qr ? `<img src="${qr}" alt="QR Code">` : '<p>Erro</p>'; }
            const connectBtn = whatsappAccountsListEl.querySelector(`.account-item[data-account-id="${accountId}"] .btn-connect`);
            if(connectBtn) { connectBtn.textContent = 'Conectar'; connectBtn.disabled = false; }
        });
        window.electronAPI.onClientsUpdated(() => { console.log('[UI] Clientes atualizados. A recarregar.'); loadClients(); });

        // Carregamento Inicial
        await loadAndRenderWhatsAppAccounts();
        await loadClients();
        showView('whatsappStatus');
    }

    initializeApp();
});
