// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { setupCronJobs, checkAndSendReminders } = require('./cronJobs');
const { clientsManager } = require('./whatsapp');
const { formatMessage, formatDate } = require('./utils');

// Schema da base de dados local
const schema = {
    whatsappAccounts: {
        type: 'array',
        default: [{ id: 'default', name: 'Conta Principal' }]
    },
    clients: {
        type: 'array',
        default: [] 
    },
    scheduleSettings: { 
        type: 'object', 
        default: { time1: '10:00', time2: '16:00' } 
    }
};

const store = new Store({ schema });
let mainWindow;

// Função para criar a janela principal da aplicação
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
        icon: path.join(__dirname, 'assets/icon.png')
    });
    
    // Inicia o gestor de contas WhatsApp, passando a janela, a base de dados e a função de callback
    clientsManager.start(mainWindow, store, handleWhatsAppChats); 
    
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
    mainWindow.on('closed', () => { mainWindow = null; });
}

// Eventos do ciclo de vida da aplicação
app.whenReady().then(() => {
    createWindow();
    const currentScheduleSettings = store.get('scheduleSettings');
    setupCronJobs(store, currentScheduleSettings, clientsManager); 
});

app.on('window-all-closed', async () => {
    const accounts = store.get('whatsappAccounts');
    for (const account of accounts) {
        await clientsManager.destroyClient(account.id);
    }
    if (process.platform !== 'darwin') app.quit();
});

// --- NOVA LÓGICA DE VALIDAÇÃO DE CONTACTOS ---
/**
 * Lida com a lista de chats/contactos recebida de uma conta WhatsApp conectada.
 * Compara com a base de dados de clientes e atualiza o status de "contactável".
 * @param {string} accountId - O ID da conta que foi conectada.
 * @param {Array<object>} chats - A lista de chats do WhatsApp.
 */
async function handleWhatsAppChats(accountId, chats) {
    console.log(`[Validation] Recebidos ${chats.length} chats da conta ${accountId}. A iniciar validação de clientes.`);
    
    // Log para depurar o formato dos números recebidos do WhatsApp
    console.log('[Validation] Exemplo de 5 números recebidos do WhatsApp:', chats.slice(0, 5).map(chat => chat.id.user));

    const clients = store.get('clients', []);
    const whatsappNumbers = new Set(chats.map(chat => chat.id.user));
    let updatedClients = 0;

    clients.forEach(client => {
        // Normaliza o número do cliente (remove tudo exceto números) para uma comparação fiável
        const clientPhone = client.phone.replace(/\D/g, ''); 
        
        if (!client.contactableBy) {
            client.contactableBy = [];
        }

        const isContactable = whatsappNumbers.has(clientPhone);
        const wasContactable = client.contactableBy.includes(accountId);

        if (isContactable && !wasContactable) {
            client.contactableBy.push(accountId);
            updatedClients++;
        } else if (!isContactable && wasContactable) {
            client.contactableBy = client.contactableBy.filter(id => id !== accountId);
            updatedClients++;
        }
    });

    if (updatedClients > 0) {
        console.log(`[Validation] ${updatedClients} clientes tiveram o seu status de contacto atualizado.`);
        store.set('clients', clients);
        if (mainWindow) {
            mainWindow.webContents.send('clients-updated');
        }
    } else {
        console.log(`[Validation] Nenhuma alteração no status de contacto dos clientes.`);
    }
}

// --- Handlers de Contas WhatsApp ---
ipcMain.handle('get-whatsapp-accounts', () => {
    const accounts = store.get('whatsappAccounts');
    const states = clientsManager.getClientsState();
    return accounts.map(acc => {
        const state = states.find(s => s.id === acc.id);
        return { ...acc, status: state ? state.status : 'disconnected' };
    });
});

ipcMain.handle('add-whatsapp-account', (event, name) => {
    const accounts = store.get('whatsappAccounts');
    const newAccount = { id: `wa-${Date.now()}`, name };
    accounts.push(newAccount);
    store.set('whatsappAccounts', accounts);
    clientsManager.addAccount(newAccount);
    return newAccount;
});

ipcMain.handle('remove-whatsapp-account', async (event, accountId) => {
    let accounts = store.get('whatsappAccounts');
    accounts = accounts.filter(acc => acc.id !== accountId);
    store.set('whatsappAccounts', accounts);
    await clientsManager.destroyClient(accountId, true);
    return { success: true };
});

ipcMain.handle('rename-whatsapp-account', (event, accountId, newName) => {
    let accounts = store.get('whatsappAccounts');
    const account = accounts.find(acc => acc.id === accountId);
    if (account) {
        account.name = newName;
        store.set('whatsappAccounts', accounts);
        clientsManager.renameAccount(accountId, newName);
    }
    return { success: !!account };
});

ipcMain.on('request-qr-code', (event, accountId) => {
    clientsManager.initializeClient(accountId);
});

// ADICIONADO: Handler para forçar revalidação
ipcMain.handle('force-validation', async (event, accountId) => {
    try {
        await clientsManager.revalidateChats(accountId);
        return { success: true, message: 'Revalidação iniciada. Os dados serão atualizados em breve.' };
    } catch (error) {
        return { success: false, message: `Erro ao revalidar: ${error.message}` };
    }
});

ipcMain.handle('disconnect-whatsapp', async (event, accountId) => {
    await clientsManager.destroyClient(accountId, false);
    return { success: true };
});

// --- Handlers de Cliente (sem imageUrl) ---
ipcMain.handle('get-clients', async () => store.get('clients', []));

ipcMain.handle('add-client', async (event, clientData) => {
    const clients = store.get('clients', []);
    clients.push(clientData);
    store.set('clients', clients);
    // Força uma revalidação em todas as contas conectadas
    clientsManager.getReadyClients().forEach((client, accountId) => {
        clientsManager.revalidateChats(accountId);
    });
    return { success: true, message: 'Cliente adicionado com sucesso!' };
});

ipcMain.handle('update-client', async (event, updatedClient) => {
    let clients = store.get('clients', []);
    const clientIndex = clients.findIndex(c => String(c.id) === String(updatedClient.id));
    if (clientIndex > -1) {
        clients[clientIndex] = updatedClient;
        store.set('clients', clients);
    }
    return { success: true, message: 'Cliente atualizado com sucesso!' };
});

ipcMain.handle('delete-client', async (event, clientId) => {
    let clients = store.get('clients', []);
    clients = clients.filter(c => String(c.id) !== String(clientId));
    store.set('clients', clients);
    return { success: true, message: 'Cliente excluído com sucesso!' };
});

// --- Handlers de Ações (Cobrança e Envio em Massa) ---
ipcMain.handle('force-charge-due-clients', async () => {
    return await checkAndSendReminders(store, "Manual", clientsManager);
});

ipcMain.handle('send-bulk-message', async (event, accountId, messageText) => {
    const readyClients = clientsManager.getReadyClients();
    if (!readyClients.has(accountId)) {
        return { success: false, message: "A conta de WhatsApp selecionada não está conectada." };
    }

    const allClients = store.get('clients', []);
    const targetClients = allClients.filter(c => 
        c.whatsappAccountId === accountId && 
        c.contactableBy && 
        c.contactableBy.includes(accountId)
    );

    if (targetClients.length === 0) {
        return { success: true, message: "Nenhum cliente contactável encontrado para esta conta." };
    }

    let successCount = 0, failureCount = 0;
    for (const client of targetClients) {
        const personalizedMessage = formatMessage(messageText, { cliente_nome: client.name });
        try {
            await clientsManager.sendMessage(accountId, client.phone, personalizedMessage);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 800));
        } catch (e) {
            failureCount++;
            console.error(`Falha ao enviar mensagem em massa para ${client.name}:`, e);
        }
    }
    return { success: true, message: `Envio concluído. ${successCount} mensagens enviadas, ${failureCount} falhas.` };
});

// --- Handlers de Configurações ---
ipcMain.handle('save-schedule-settings', async (event, settings) => {
    store.set('scheduleSettings', settings);
    setupCronJobs(store, settings, clientsManager);
    return { success: true };
});

ipcMain.handle('get-schedule-settings', async () => store.get('scheduleSettings'));
