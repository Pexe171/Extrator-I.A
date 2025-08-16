// utils.js

/**
 * Formata uma string de mensagem substituindo placeholders pelos valores fornecidos.
 * Placeholders devem estar no formato {nome_do_placeholder}.
 * Exemplo: "Olá {cliente_nome}, a sua fatura vence em {data_vencimento}."
 * @param {string} template A string do modelo com placeholders.
 * @param {object} context Um objeto onde as chaves são os nomes dos placeholders e os valores são o que os substituirá.
 * @returns {string} A mensagem formatada.
 */
function formatMessage(template, context) {
    if (typeof template !== 'string') { // Adicionada verificação de tipo
        console.warn("formatMessage: template não é uma string:", template);
        return ""; 
    }
    let message = template;
    for (const key in context) {
        if (Object.prototype.hasOwnProperty.call(context, key)) {
            const placeholder = `{${key}}`;
            // Garante que o valor de substituição seja uma string
            const replacement = (typeof context[key] === 'string' || typeof context[key] === 'number') ? String(context[key]) : '';
            try {
                message = message.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
            } catch (e) {
                console.error("Erro no formatMessage replace:", e, "Placeholder:", placeholder, "Replacement:", replacement);
            }
        }
    }
    return message;
}

/**
 * Calcula a diferença de dias entre a data atual e uma data de vencimento.
 * Retorna uma string descritiva (ex: "Hoje", "Vence em X dia(s)", "Vencido há X dia(s)").
 * @param {string} dueDateString A data de vencimento no formato<y_bin_46>-MM-DD.
 * @returns {string} Uma string descrevendo o status do vencimento.
 */
function getDaysUntilDue(dueDateString) {
    if (!dueDateString || typeof dueDateString !== 'string') return 'Data inválida';

    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    const dateParts = dueDateString.split('-');
    if (dateParts.length !== 3) return 'Data inválida';

    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; 
    const day = parseInt(dateParts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return 'Data inválida';
    
    const dueDate = new Date(year, month, day); 
    dueDate.setHours(0,0,0,0); 

    if (isNaN(dueDate.getTime())) return 'Data inválida';

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return `Vencido há ${Math.abs(diffDays)} dia(s)`;
    } else if (diffDays === 0) {
        return 'Hoje';
    } else {
        return `Em ${diffDays} dia(s)`;
    }
}

/**
 * Formata uma string de data (YYYY-MM-DD) para o formato dd/mm/yyyy.
 * @param {string} dateString A data no formato YYYY-MM-DD.
 * @returns {string} A data formatada ou 'N/A'.
 */
function formatDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return 'N/A';
    const parts = dateString.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Mês em JS é 0-indexado
        const day = parseInt(parts[2], 10);
        if (isNaN(year) || isNaN(month) || isNaN(day)) return 'Data Inválida';
        const localDate = new Date(year, month, day);
        if (isNaN(localDate.getTime())) return 'Data Inválida';
        return localDate.toLocaleDateString('pt-BR'); // Formato dd/mm/yyyy
    }
    console.warn("formatDate (utils.js): formato de data inesperado:", dateString);
    return dateString; // Retorna a string original se não for o formato esperado
}


module.exports = {
    formatMessage,
    getDaysUntilDue,
    formatDate // GARANTIR QUE ESTÁ EXPORTADO
};
