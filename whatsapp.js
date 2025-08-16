// whatsapp.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');

/**
 * Gestor de múltiplas instâncias de clientes WhatsApp.
 */
const clientsManager = {
    clients: new Map(),
    mainWindow: null,
    store: null,
    chatValidationCallback: null,

    /**
     * Inicia o gestor.
     * @param {BrowserWindow} mainWindow - Janela principal para comunicação com a UI.
     * @param {Store} electronStore - Acesso à base de dados.
     * @param {Function} chatCallback - Função a ser chamada com os chats quando uma conta conecta.
     */
    start(mainWindow, electronStore, chatCallback) {
        this.mainWindow = mainWindow;
        this.store = electronStore;
        this.chatValidationCallback = chatCallback;
        this.loadAccountsFromStore();
    },
    
    /**
     * Carrega as contas da base de dados para o mapa de controlo.
     */
    loadAccountsFromStore() {
        const accounts = this.store.get('whatsappAccounts', []);
        this.clients.clear();
        accounts.forEach(acc => {
            this.clients.set(acc.id, {
                name: acc.name,
                client: null,
                isReady: false,
                isInitializing: false,
                status: 'disconnected'
            });
        });
    },

    /**
     * Cria e inicializa uma instância do cliente WhatsApp.
     * @param {string} accountId - O ID da conta a ser iniciada.
     */
    async initializeClient(accountId) {
        const clientState = this.clients.get(accountId);
        if (!clientState || clientState.isInitializing || clientState.client) {
            return;
        }

        console.log(`[WhatsAppManager] A iniciar cliente para a conta: ${accountId}`);
        clientState.isInitializing = true;
        this.updateAccountState(accountId, 'initializing');

        const waClient = new Client({
            authStrategy: new LocalAuth({ 
                clientId: accountId,
                dataPath: "sessions" 
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
            }
        });

        clientState.client = waClient;

        waClient.on('qr', (qr) => {
            console.log(`[WhatsAppManager-${accountId}] QR Code recebido.`);
            this.updateAccountState(accountId, 'qr');
            QRCode.toDataURL(qr).then(url => {
                this.mainWindow.webContents.send('whatsapp-qr-code', accountId, url);
            });
        });

        waClient.on('ready', async () => {
            console.log(`[WhatsAppManager-${accountId}] Cliente está pronto!`);
            clientState.isReady = true;
            this.updateAccountState(accountId, 'ready');
            this.revalidateChats(accountId); // Força a validação ao conectar
        });

        waClient.on('disconnected', (reason) => {
            console.log(`[WhatsAppManager-${accountId}] Cliente desconectado:`, reason);
            this.destroyClient(accountId, false);
        });

        try {
            await waClient.initialize();
        } catch (error) {
            console.error(`[WhatsAppManager-${accountId}] Erro crítico na inicialização:`, error);
            await this.destroyClient(accountId, false);
        } finally {
            clientState.isInitializing = false;
        }
    },

    /**
     * Força uma nova leitura dos chats para validação de contactos.
     * @param {string} accountId 
     */
    async revalidateChats(accountId) {
        const clientState = this.clients.get(accountId);
        if (!clientState || !clientState.isReady) {
            throw new Error('A conta não está conectada para revalidar os chats.');
        }
        try {
            const chats = await clientState.client.getChats();
            console.log(`[WhatsAppManager-${accountId}] Revalidação: ${chats.length} chats encontrados.`);
            if (this.chatValidationCallback) {
                this.chatValidationCallback(accountId, chats);
            }
        } catch (err) {
            console.error(`[WhatsAppManager-${accountId}] Erro ao revalidar chats:`, err);
            throw err;
        }
    },

    /**
     * Encerra a sessão de um cliente.
     * @param {string} accountId - O ID da conta a ser destruída.
     * @param {boolean} fullRemove - Se deve remover a conta completamente.
     */
    async destroyClient(accountId, fullRemove = false) {
        const clientState = this.clients.get(accountId);
        if (clientState?.client) {
            await clientState.client.destroy().catch(() => {});
        }
        
        if (fullRemove) {
            this.clients.delete(accountId);
        } else if (clientState) {
            clientState.client = null;
            clientState.isReady = false;
            clientState.isInitializing = false;
            this.updateAccountState(accountId, 'disconnected');
        }
        this.updateOverallState();
    },
    
    addAccount(account) {
        this.clients.set(account.id, {
            name: account.name,
            client: null,
            isReady: false,
            isInitializing: false,
            status: 'disconnected'
        });
        this.updateOverallState();
    },
    
    renameAccount(accountId, newName) {
        const clientState = this.clients.get(accountId);
        if(clientState) {
            clientState.name = newName;
            this.updateOverallState();
        }
    },

    async sendMessage(accountId, phoneNumber, message) {
        const clientState = this.clients.get(accountId);
        if (!clientState || !clientState.isReady) {
            throw new Error(`Conta WhatsApp ${clientState?.name || accountId} não está conectada.`);
        }
        const chatId = phoneNumber.endsWith('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
        await clientState.client.sendMessage(chatId, message);
    },
    
    updateAccountState(accountId, status) {
        const clientState = this.clients.get(accountId);
        if (clientState) {
            clientState.status = status;
            this.updateOverallState();
        }
    },
    
    updateOverallState() {
        if (this.mainWindow?.webContents) {
            this.mainWindow.webContents.send('whatsapp-state-change', this.getClientsState());
        }
    },
    
    getClientsState() {
        const stateArray = [];
        for (const [id, state] of this.clients.entries()) {
            stateArray.push({ id, name: state.name, status: state.status });
        }
        return stateArray;
    },

    getReadyClients() {
        const readyClients = new Map();
        for (const [id, state] of this.clients.entries()) {
            if (state.isReady && state.client) {
                readyClients.set(id, state.client);
            }
        }
        return readyClients;
    }
};

module.exports = { clientsManager };
