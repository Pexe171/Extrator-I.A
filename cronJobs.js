// cronJobs.js
const cron = require('node-cron');
const { formatMessage, formatDate } = require('./utils');

let scheduledJobs = [];

const DEFAULT_REMINDER_MESSAGE_TEMPLATE = `📢 ATENÇÃO, {cliente_nome}!\nEstamos passando para lembrar que sua assinatura venceu em {data_vencimento}.\n⚠️ É muito importante regularizar o seu pagamento.\n\nPagamentos em atraso podem estar sujeitos a taxas adicionais ou interrupção do serviço.\n💡 Entre em contato para resolver a sua pendência.\nContamos com sua colaboração!`;

function stopAllScheduledJobs() {
    if (scheduledJobs.length > 0) {
        console.log('[CronJob] Parando agendamentos de cobrança anteriores.');
        scheduledJobs.forEach(job => job.stop());
        scheduledJobs = [];
    }
}

/**
 * Verifica os clientes e envia lembretes para os que estão vencidos e contactáveis.
 * @param {Store} electronStore - Acesso à base de dados.
 * @param {string} executionType - "Manual" ou "Agendado".
 * @param {object} manager - O gestor de clientes WhatsApp.
 */
async function checkAndSendReminders(electronStore, executionType, manager) {
    console.log(`[Cobrança][${executionType}] Iniciando verificação de cobranças.`);

    if (!manager) {
        return { success: false, message: "Erro: Gestor de WhatsApp não disponível." };
    }
    
    const readyClients = manager.getReadyClients();
    if (readyClients.size === 0) {
        return { success: true, message: "Nenhuma conta de WhatsApp está conectada. A cobrança foi cancelada." };
    }
    
    const allClients = electronStore.get('clients', []);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let clientsFound = 0;
    let messagesSent = 0;
    let messagesFailed = 0;

    for (const client of allClients) {
        const dueDate = new Date(client.dueDate + 'T00:00:00');
        const isOverdue = dueDate.getTime() <= today.getTime();

        if (isOverdue) {
            clientsFound++;
            const accountId = client.whatsappAccountId;
            const isContactable = client.contactableBy && client.contactableBy.includes(accountId);

            if (readyClients.has(accountId) && isContactable) {
                const messageContext = {
                    cliente_nome: client.name,
                    data_vencimento: formatDate(client.dueDate),
                };
                const personalizedMessage = formatMessage(DEFAULT_REMINDER_MESSAGE_TEMPLATE, messageContext);

                try {
                    await manager.sendMessage(accountId, client.phone, personalizedMessage);
                    messagesSent++;
                    console.log(`[Cobrança] Mensagem enviada para ${client.name} via conta ${accountId}.`);
                    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
                } catch (error) {
                    messagesFailed++;
                    console.error(`[Cobrança] Falha ao enviar para ${client.name} via ${accountId}:`, error.message);
                }
            } else {
                 console.log(`[Cobrança] Cliente ${client.name} está vencido, mas não é contactável pela conta ${accountId} ou a conta não está pronta.`);
                 messagesFailed++;
            }
        }
    }
    
    const summary = `Verificação concluída. Clientes vencidos encontrados: ${clientsFound}. Mensagens enviadas: ${messagesSent}. Falhas/Não contactáveis: ${messagesFailed}.`;
    console.log(`[Cobrança][${executionType}] ${summary}`);
    return { success: true, message: summary };
}

/**
 * Configura as tarefas agendadas de cobrança.
 * @param {Store} electronStore - Acesso à base de dados.
 * @param {object} scheduleSettings - As configurações de horário.
 * @param {object} manager - O gestor de clientes WhatsApp.
 */
function setupCronJobs(electronStore, scheduleSettings, manager) {
    stopAllScheduledJobs();

    const times = [scheduleSettings?.time1, scheduleSettings?.time2].filter(t => t);

    times.forEach((time, index) => {
        if (time && /^\d{2}:\d{2}$/.test(time)) {
            const [hour, minute] = time.split(':');
            const cronPattern = `${minute} ${hour} * * *`;
            
            const job = cron.schedule(cronPattern, () => checkAndSendReminders(electronStore, `Agendado ${time}`, manager), {
                scheduled: true
            });
            scheduledJobs.push(job);
            console.log(`[CronJob] Tarefa ${index + 1} agendada para as ${time} (horário local da máquina).`);
        }
    });
}

module.exports = { setupCronJobs, checkAndSendReminders };
