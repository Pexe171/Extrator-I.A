// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Funções de Cliente
  getClients: () => ipcRenderer.invoke('get-clients'),
  addClient: (clientData) => ipcRenderer.invoke('add-client', clientData),
  updateClient: (clientData) => ipcRenderer.invoke('update-client', clientData),
  deleteClient: (clientId) => ipcRenderer.invoke('delete-client', clientId),

  // Funções de Contas WhatsApp
  getWhatsAppAccounts: () => ipcRenderer.invoke('get-whatsapp-accounts'),
  addWhatsAppAccount: (name) => ipcRenderer.invoke('add-whatsapp-account', name),
  removeWhatsAppAccount: (accountId) => ipcRenderer.invoke('remove-whatsapp-account', accountId),
  renameWhatsAppAccount: (accountId, newName) => ipcRenderer.invoke('rename-whatsapp-account', accountId, newName),
  
  requestQRCode: (accountId) => ipcRenderer.send('request-qr-code', accountId),
  disconnectWhatsApp: (accountId) => ipcRenderer.invoke('disconnect-whatsapp', accountId),
  forceValidation: (accountId) => ipcRenderer.invoke('force-validation', accountId),

  // Listeners de eventos para a UI
  onWhatsAppStateChange: (callback) => ipcRenderer.on('whatsapp-state-change', (_event, accounts) => callback(accounts)),
  onWhatsAppQRCode: (callback) => ipcRenderer.on('whatsapp-qr-code', (_event, accountId, qr) => callback(accountId, qr)),
  onClientsUpdated: (callback) => ipcRenderer.on('clients-updated', () => callback()),

  // Funções de Mensagens
  forceChargeDueClients: () => ipcRenderer.invoke('force-charge-due-clients'),
  sendBulkMessage: (accountId, messageText) => ipcRenderer.invoke('send-bulk-message', accountId, messageText),

  // Funções de Configurações
  getScheduleSettings: () => ipcRenderer.invoke('get-schedule-settings'),
  saveScheduleSettings: (settings) => ipcRenderer.invoke('save-schedule-settings', settings),

  // Gestão de Listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
