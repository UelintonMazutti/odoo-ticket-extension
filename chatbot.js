function initChatbot() {
    console.log("[OdooExt] Iniciando Chatbot...");

    // Evitar duplicação
    if (document.getElementById("odoo-chatbot-container")) {
        console.log("[OdooExt] Chatbot já existe na página.");
        return;
    }

    // Inject HTML
    const container = document.createElement("div");
    container.id = "odoo-chatbot-container";
    container.innerHTML = `
    <div id="odoo-chatbot-window">
      <div class="odoo-chatbot-header">
        <span>🤖 Assistente Odoo</span>
        <span class="odoo-chatbot-close">&times;</span>
      </div>
      <div class="odoo-chatbot-messages" id="odoo-chatbot-messages">
        <div class="odoo-message bot">Olá! Como posso ajudar com os tickets hoje?</div>
        <div class="odoo-action-cards-container">
            <div class="odoo-action-card" data-action="meus_tickets">Meus Tickets</div>
            <div class="odoo-action-card" data-action="tickets_semana">Tickets da Semana</div>
            <div class="odoo-action-card" data-action="tickets_cliente">Tickets por Cliente</div>
            <div class="odoo-action-card" data-action="contagem_cliente">Qtd. por Cliente</div>
            <div class="odoo-action-card" data-action="resumo_finalizados">Resumo Finalizados</div>
            <div class="odoo-action-card" data-action="configuracao">Configuração</div>
            <div class="odoo-action-card" data-action="ajuda">Ajuda</div>
        </div>
      </div>
      <div class="odoo-chatbot-input-area">
        <input type="text" id="odoo-chatbot-input" placeholder="Digite sua pergunta..." autocomplete="off">
        <button id="odoo-chatbot-send"><i class="fa fa-paper-plane"></i> ➤</button>
      </div>
    </div>
    <button id="odoo-chatbot-toggle">💬</button>
  `;
    document.body.appendChild(container);

    // References
    const toggleBtn = document.getElementById("odoo-chatbot-toggle");
    const chatWindow = document.getElementById("odoo-chatbot-window");
    const closeBtn = document.querySelector(".odoo-chatbot-close");
    const input = document.getElementById("odoo-chatbot-input");
    const sendBtn = document.getElementById("odoo-chatbot-send");
    const messagesContainer = document.getElementById("odoo-chatbot-messages");

    // Toggle Chat
    toggleBtn.addEventListener("click", () => {
        chatWindow.classList.toggle("open");
        if (chatWindow.classList.contains("open")) {
            input.focus();
            checkApiKey();
        }
    });

    closeBtn.addEventListener("click", () => {
        chatWindow.classList.remove("open");
    });

    // Check API Key
    async function checkApiKey() {
        const stored = await chrome.storage.local.get("geminiApiKey");
        if (!stored.geminiApiKey) {
            const msgDiv = document.createElement("div");
            msgDiv.className = "odoo-message system";
            msgDiv.innerHTML = '⚠️ API Key não configurada. <button id="odoo-open-options" style="background:#714B67; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-top:5px;">Configurar Agora</button>';
            messagesContainer.appendChild(msgDiv);

            setTimeout(() => {
                const btn = document.getElementById("odoo-open-options");
                if (btn) {
                    btn.addEventListener("click", () => {
                        chrome.runtime.sendMessage({ action: "openOptions" });
                    });
                }
            }, 100);

            input.disabled = true;
        } else {
            input.disabled = false;
        }
    }

    // Add Message to UI
    function addMessage(sender, text) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `odoo-message ${sender}`;

        // Use innerHTML for system (links/buttons) and bot (markdown) messages
        if (sender === 'system' || sender === 'bot') {
            msgDiv.innerHTML = text;

            // Apply status styling and make clickable
            if (sender === 'bot') {
                const listItems = msgDiv.querySelectorAll('li.odoo-chat-list-item');

                listItems.forEach(li => {
                    // 1. Status Styling Logic
                    const text = li.textContent.toLowerCase();
                    const closedStatuses = ['encerrado', 'notificado', 'disponível para suporte', 'cancelado', 'recusado'];

                    const isClosed = closedStatuses.some(s => text.includes(s));

                    if (isClosed) {
                        li.classList.add('status-closed');
                    } else {
                        li.classList.add('status-open');
                    }

                    // 2. Click Logic
                    const link = li.querySelector('a');
                    if (link) {
                        li.style.cursor = 'pointer';
                        li.title = "Clique para abrir o ticket";
                        li.addEventListener('click', (e) => {
                            let url = link.getAttribute('href');
                            if (url.startsWith('/')) {
                                url = location.origin + url;
                            }
                            if (e.target !== link) {
                                window.open(url, '_blank');
                            }
                        });
                    }
                });
            }
        } else {
            msgDiv.textContent = text;
        }
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // --- Gemini API Logic ---

    const HISTORY_LIMIT = 10;
    let chatHistory = [];

    async function handleSend() {
        const text = input.value.trim();
        if (!text) return;

        addMessage("user", text);
        input.value = "";

        const typingId = showTyping();

        try {
            // Add to History
            chatHistory.push({ role: "user", parts: [{ text: text }] });

            // 1. First Call to Gemini
            let response = await callGeminiAPI(chatHistory);

            // 2. Loop for Function Calls
            let turns = 0;
            while (response.candidates && response.candidates[0].content.parts[0].functionCall && turns < 3) {
                const part = response.candidates[0].content.parts[0];
                const functionCall = part.functionCall;

                console.log("Gemini requested tool:", functionCall.name);

                // Execute Tool
                const toolResult = await executeTool(functionCall.name, functionCall.args);

                // Add Gemini's request to history
                chatHistory.push(response.candidates[0].content);

                // Add Tool Response to history
                chatHistory.push({
                    role: "function",
                    parts: [{
                        functionResponse: {
                            name: functionCall.name,
                            response: { name: functionCall.name, content: toolResult }
                        }
                    }]
                });

                turns++;
                response = await callGeminiAPI(chatHistory);
            }

            removeTyping(typingId);

            if (response.candidates && response.candidates[0].content.parts[0].text) {
                const finalAnswer = response.candidates[0].content.parts[0].text;
                chatHistory.push(response.candidates[0].content);
                addMessage("bot", marked.parse(finalAnswer));
            } else {
                addMessage("bot", "Desculpe, não consegui gerar uma resposta.");
            }

        } catch (err) {
            console.error(err);
            removeTyping(typingId);
            addMessage("system", "Erro: " + err.message);
        }
    }

    async function callGeminiAPI(history) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: "callGemini", history: history }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Runtime error:", chrome.runtime.lastError);
                    return reject(new Error("Erro de comunicação com a extensão."));
                }
                if (response && response.error) {
                    return reject(new Error(response.error));
                }
                resolve(response);
            });
        });
    }

    async function executeTool(name, args) {
        if (name === "search_tickets") return await searchTicketsOdoo(args.query, args.stage || null, args.status_scope || 'open', args.assigned_to_me || false, args.offset || 0, args.date_period || null, args.date_field || 'create_date');
        if (name === "count_tickets") return await countTicketsOdoo(args.query, args.stage || null, args.status_scope || 'open', args.assigned_to_me || false, args.date_period || null, args.date_field || 'create_date');
        if (name === "get_ticket_details") return await getTicketDetailsOdoo(args.ticket_id);
        if (name === "get_my_tickets") return await getMyTicketsOdoo();
        return { error: "Ferramenta desconhecida" };
    }

    async function getSessionInfo() {
        try {
            const response = await fetch("/web/session/get_session_info", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "call", params: {} })
            });
            if (!response.ok) throw new Error("Falha na requisição de sessão (HTTP " + response.status + ")");
            const session = await response.json();
            if (session.error) throw new Error(session.error.data?.message || session.error.message || "Erro de sessão no Odoo");
            if (!session.result || !session.result.uid) throw new Error("UID de usuário não encontrado na sessão.");
            return session.result;
        } catch (e) {
            console.error("[OdooExt] Error getting session:", e);
            throw e;
        }
    }

    async function buildTicketDomain(query, stage, statusScope, assignedToMe, datePeriod) {
        let domain = [];

        // Base Query Logic
        if (query) {
            domain.push("|", "|", "|", "|", "|",
                ["name", "ilike", query],
                ["description", "ilike", query],
                ["partner_id", "ilike", query],
                ["x_studio_sigla_cliente", "ilike", query],
                ["ticket_ref", "ilike", query],
                ["id", "=", parseInt(query) || -1]
            );
        }

        // Stage Filter
        if (stage) {
            domain.push(["stage_id", "ilike", stage]);
        }

        // Assigned To Me Filter
        if (assignedToMe) {
            const session = await getSessionInfo();
            domain.push(["user_id", "=", session.uid]);
        }

        // Date Period Filter
        if (datePeriod) {
            const now = new Date();
            let start = new Date(now);
            let end = new Date(now);

            // Reset time to start/end of day
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);

            if (datePeriod === 'today') {
                // Already set for today
            } else if (datePeriod === 'yesterday') {
                start.setDate(start.getDate() - 1);
                end.setDate(end.getDate() - 1);
            } else if (datePeriod === 'this_week') {
                // Assuming week starts on Monday (1)
                const day = start.getDay() || 7; // Sunday is 0, make it 7
                if (day !== 1) start.setHours(-24 * (day - 1));
                // End is implicitly today/end of week, but 'this week' usually means up to now or full week. 
                // Let's go with 'from start of week'.
            } else if (datePeriod === 'last_week') {
                const day = start.getDay() || 7;
                start.setDate(start.getDate() - day - 6);
                end.setDate(end.getDate() - day);
            } else if (datePeriod === 'this_month') {
                start.setDate(1);
            } else if (datePeriod === 'last_month') {
                start.setMonth(start.getMonth() - 1);
                start.setDate(1);
                end.setDate(0); // Last day of previous month
            }

            // Odoo expects 'YYYY-MM-DD HH:mm:ss' in UTC usually, but domain filters are often client-timezone sensitive or just plain strings.
            // Let's format as string. Important: Odoo stores in UTC. If we send local time string, it might be interpreted as UTC or Local depending on context.
            // Safe bet: Convert to UTC string for comparison if field is datetime. 'create_date' is datetime.

            const formatDate = (d) => d.toISOString().replace('T', ' ').substring(0, 19);

            domain.push(["create_date", ">=", formatDate(start)]);
            if (datePeriod !== 'this_week' && datePeriod !== 'this_month') {
                // For current periods, we want ">= start". For specific past periods, we might want range.
                // Actually simpler: 
                // today: >= start AND <= end
                // yesterday: >= start AND <= end
                domain.push(["create_date", "<=", formatDate(end)]);
            }
        }

        // Status Scope Filter
        const CLOSED_STAGES = ["Encerrado", "Notificado", "Disponível Para Suporte", "Cancelado", "Recusado", "Cancelado/Recusado"];

        if (statusScope === 'open') {
            domain.push(["stage_id", "not in", CLOSED_STAGES]);
        } else if (statusScope === 'closed') {
            domain.push(["stage_id", "in", CLOSED_STAGES]);
        }

        return domain;
    }

    async function searchTicketsOdoo(query, stage = null, statusScope = 'open', assignedToMe = false, offset = 0, datePeriod = null, dateField = 'create_date') {
        try {
            const domain = await buildTicketDomain(query, stage, statusScope, assignedToMe, datePeriod, dateField);

            const limit = 10;
            // Fetch one extra to check if there are more
            const results = await rpcCall("helpdesk.ticket", "search_read", [domain], {
                fields: ["id", "name", "ticket_ref", "partner_id", "stage_id", "user_id", "create_date"],
                limit: limit + 1,
                offset: offset,
                order: "create_date desc"
            });

            let hasMore = false;
            if (results.length > limit) {
                hasMore = true;
                results.pop(); // Remove the 11th item
            }

            return {
                results: results,
                has_more: hasMore,
                next_offset: offset + limit,
                total_found_message: hasMore ? "Existem mais resultados. Pergunte se o usuário quer ver os próximos." : ""
            };
        } catch (e) {
            return { error: "Erro na busca: " + e.message };
        }
    }

    async function countTicketsOdoo(query, stage = null, statusScope = 'open', assignedToMe = false, datePeriod = null, dateField = 'create_date') {
        try {
            const domain = await buildTicketDomain(query, stage, statusScope, assignedToMe, datePeriod, dateField);
            const count = await rpcCall("helpdesk.ticket", "search_count", [domain], {});
            return {
                count: count,
                message: `Encontrei ${count} tickets com esses filtros.`
            };
        } catch (e) {
            console.error("Count Tickets Error:", e);
            return {
                error: "Erro Técnico",
                details: e.message || String(e),
                tip: "Verifique se você está logado no Odoo ou se a conexão foi perdida."
            };
        }
    }

    async function getTicketDetailsOdoo(id) {
        return await rpcCall("helpdesk.ticket", "read", [[parseInt(id)]], { fields: [] });
    }

    async function getMyTicketsOdoo() {
        try {
            const session = await getSessionInfo();
            const domain = [["user_id", "=", session.uid]];
            return await rpcCall("helpdesk.ticket", "search_read", [domain], {
                fields: ["id", "name", "ticket_ref", "partner_id", "stage_id", "user_id", "create_date"],
                limit: 10,
                order: "create_date desc"
            });
        } catch (e) {
            return { error: "Erro ao buscar meus tickets: " + e.message };
        }
    }

    async function rpcCall(model, method, args, kwargs) {
        const payload = {
            jsonrpc: "2.0", method: "call",
            params: { model, method, args, kwargs },
            id: Date.now()
        };
        try {
            const response = await fetch(`${location.origin}/web/dataset/call_kw/${model}/${method}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const res = await response.json();

            if (res.error) {
                console.error("[OdooRPC] Error:", res.error);
                throw new Error(res.error.data?.message || res.error.message || "Erro desconhecido no Odoo");
            }
            return res.result;
        } catch (e) {
            console.error("[OdooRPC] Failed:", e);
            throw e;
        }
    }

    const marked = {
        parse: (text) => {
            let html = text
                // Escape HTML (simple)
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

                // Bold
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

                // Links
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')

                // Lists (unordered) - crude but effective for * items
                .replace(/^\s*[\-\*]\s+(.*)$/gm, '<li class="odoo-chat-list-item">$1</li>')
                .replace(/(<li.*<\/li>)/s, '<ul class="odoo-chat-list">$1</ul>') // Wrap first occurrence? No, regex replace all won't wrap validly.

            // Fix list wrapping manually
            // Only wrap sequential li's in ul
            // Simple approach: split by lines
            const lines = html.split('\n');
            let output = [];
            let inList = false;

            lines.forEach(line => {
                if (line.includes('<li class="odoo-chat-list-item">')) {
                    if (!inList) {
                        output.push('<ul class="odoo-chat-list">');
                        inList = true;
                    }
                    output.push(line);
                } else {
                    if (inList) {
                        output.push('</ul>');
                        inList = false;
                    }
                    // Handle normal lines (breaks)
                    if (line.trim() !== "") output.push(line + '<br>');
                }
            });
            if (inList) output.push('</ul>');

            return output.join('');
        }
    };

    // Typing Indicator
    function showTyping() {
        const id = "typing-" + Date.now();
        const div = document.createElement("div");
        div.id = id;
        div.className = "odoo-message bot typing-indicator";
        div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return id;
    }

    function removeTyping(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    sendBtn.addEventListener("click", handleSend);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleSend();
    });

    // Action Cards Logic
    const actionCards = container.querySelectorAll(".odoo-action-card");
    actionCards.forEach(card => {
        card.addEventListener("click", () => {
            const action = card.getAttribute("data-action");
            handleActionCard(action);
        });
    });

    function handleActionCard(action) {
        let text = "";
        let autoSend = true;

        switch (action) {
            case "meus_tickets":
                text = "Quais são os meus tickets em aberto?";
                break;
            case "tickets_semana":
                text = "Quantos tickets foram criados nesta semana?";
                break;
            case "tickets_cliente":
                text = "Quais tickets estão abertos para o cliente [Nome do Cliente]?";
                autoSend = false;
                break;
            case "contagem_cliente":
                text = "Quantos tickets o cliente [Nome do Cliente] tem em aberto?";
                autoSend = false;
                break;
            case "resumo_finalizados":
                text = "Quantos tickets foram finalizados hoje, nesta semana e neste mês?";
                break;
            case "configuracao":
                chrome.runtime.sendMessage({ action: "openOptions" });
                return; // Don't send text
            case "ajuda":
                text = "O que você pode fazer?";
                break;
        }

        if (text) {
            input.value = text;
            if (autoSend) {
                handleSend();
            } else {
                input.focus();
                // Select the placeholder part if possible, otherwise just focus
                if (text.includes("[Nome do Cliente]")) {
                    const start = text.indexOf("[");
                    const end = text.indexOf("]") + 1;
                    input.setSelectionRange(start, end);
                }
            }
        }
    }
}

// Inicialização Robust
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatbot);
} else {
    initChatbot(); // Ensure it runs if already loaded
}
