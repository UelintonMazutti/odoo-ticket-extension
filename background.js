chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "callGemini") {
        callGeminiAPI(request.history).then(sendResponse).catch(err => sendResponse({ error: err.message }));
        return true; // Keep channel open
    } else if (request.action === "openOptions") {
        chrome.runtime.openOptionsPage();
    }
});

async function callGeminiAPI(history) {
    const stored = await chrome.storage.local.get(["geminiApiKey", "geminiApiModel"]);
    const apiKey = stored.geminiApiKey;
    const model = stored.geminiApiModel || "gemini-1.5-flash"; // Fallback default

    if (!apiKey) throw new Error("API Key não configurada. Configure nas opções da extensão.");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemInstruction = {
        role: "user",
        parts: [{
            text: `Você é um assistente útil (Chatbot Odoo) especializado em ajudar com tickets do Odoo Helpdesk.
        Sempre responda em Português do Brasil.
        Não invente informações. Se precisar de dados, use as ferramentas disponíveis.
        o formato de lista DEVE SER: * [**#ticket_ref**](/odoo/all-tickets/id_do_banco): Assunto (Status: ...).
        Isso garante que o usuário possa clicar.
        Exemplo: * [**#77685**](/odoo/all-tickets/109667): Supply - Melhoria... (Status: Novo)
        
        Considere como "Finalizados/Fechados": 'Encerrado', 'Notificado', 'Disponível Para Suporte', 'Cancelado/Recusado'.
        Qualquer outro status é considerado "Em Aberto".
        
        FORMATO DO CARD (Tudo na mesma linha):
        * [**#ticket_ref**](/odoo/all-tickets/id_do_banco): Assunto - (**Status**: X | **Resp**: Nome | **Data**: DD/MM/YYYY)
        
        PAGINAÇÃO:
        Se o resultado da busca indicar que "Existem mais resultados", liste os 10 primeiros e pergunte ao usuário se deseja ver os próximos.
        Para ver a próxima página, chame search_tickets com o mesmo termo e o offset indicado.
        
        SEGURANÇA (CRÍTICO):
        1. Você NÃO tem permissão para gerar, sugerir ou executar comandos SQL.
        2. Você NÃO tem permissão para DELETAR, CRIAR ou MODIFICAR tickets. Suas ferramentas são apenas de LEITURA.
        3. Se o usuário pedir para deletar ou rodar SQL, recuse educadamente explicando suas limitações de segurança.
        4. SE UMA FERRAMENTA RETORNAR ERRO: Mostre a mensagem de erro técnica ('details') para o usuário para ajudar na depuração. Ex: "Houve um erro: [detalhes]".
        
        FILTRO POR ESTÁGIO:
                Se o usuário pedir tickets em uma coluna/ fase específica(ex: "Tickets em Análise", "O que está em Desenvolver?"), use o parâmetro 'stage' na ferramenta search_tickets.
        
        FILTRO POR STATUS GERAL(Abertos vs Finalizados):
        - Se o usuário pedir tickets "Em Aberto"(padrão) -> status_scope='open'
        - Se o usuário pedir tickets "Finalizados/Fechados/Antigos" -> status_scope='closed'
        - Se o usuário pedir explicitamente "Todos" -> status_scope='all'
        
        FILTRO "MEUS TICKETS" + OUTROS:
        - Se o usuário disser "Meus tickets em desenvolvimento" ou "Tickets atribuídos a mim na fase X", combine 'assigned_to_me=true' com 'stage=X'.

            CONTAGEM:
        - Se o usuário perguntar "Quantos tickets...", "Qual o total de tickets...", use a ferramenta count_tickets.
        - NÃO use search_tickets para contar, pois ela tem paginação.` }]
    };

    const tools = [{
        function_declarations: [
            {
                name: "search_tickets",
                description: "Busca tickets por termo (cliente, assunto, descrição).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Termo de busca (assunto, id, etc). Deixe vazio se quiser listar todos de um estágio." },
                        stage: { type: "STRING", description: "Nome do estágio/coluna Kanban (ex: 'Desenvolver', 'Análise')." },
                        status_scope: { type: "STRING", enum: ["open", "closed", "all"], description: "Filtro de status: 'open' (em aberto), 'closed' (finalizados), 'all' (todos). Padrão 'open'." },
                        assigned_to_me: { type: "BOOLEAN", description: "Se true, filtra apenas tickets atribuídos ao usuário atual." },
                        offset: { type: "INTEGER", description: "Página/Deslocamento (múltiplos de 10). Padrão 0." }
                    },
                    required: ["query"]
                }
            },
            {
                name: "get_ticket_details",
                description: "Busca detalhes de um ticket pelo ID.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        ticket_id: { type: "INTEGER", description: "ID do ticket" }
                    },
                    required: ["ticket_id"]
                }
            },
            {
                name: "get_my_tickets",
                description: "Lista tickets atribuídos a mim (usuário atual).",
                parameters: { type: "OBJECT", properties: {} }
            },
            {
                name: "count_tickets",
                description: "Retorna a contagem total de tickets baseada em filtros (Cliente, Sigla, Estágio, Status).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Termo de busca (Nome do cliente, Sigla, Assunto)." },
                        stage: { type: "STRING", description: "Nome do estágio (ex: 'Desenvolver')." },
                        status_scope: { type: "STRING", enum: ["open", "closed", "all"], description: "Filtro de status (padrao 'open')." },
                        assigned_to_me: { type: "BOOLEAN", description: "Filtrar por 'meus tickets'." }
                    },
                    // Query removed from required to allow filtering only by stage/status
                    // required: ["query"] 
                }
            }
        ]
    }];

    const contents = [systemInstruction, ...history];
    const payload = { contents, tools };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Erro na API Gemini");
    }

    return await response.json();
}