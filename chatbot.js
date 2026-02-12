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
        if (name === "search_tickets") return await searchTicketsOdoo(args.query, args.stage || null, args.status_scope || 'open', args.assigned_to_me || false, args.offset || 0);
        if (name === "count_tickets") return await countTicketsOdoo(args.query, args.stage || null, args.status_scope || 'open', args.assigned_to_me || false);
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

    async function buildTicketDomain(query, stage, statusScope, assignedToMe) {
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

        // Status Scope Filter
        const CLOSED_STAGES = ["Encerrado", "Notificado", "Disponível Para Suporte", "Cancelado", "Recusado", "Cancelado/Recusado"];

        if (statusScope === 'open') {
            domain.push(["stage_id", "not in", CLOSED_STAGES]);
        } else if (statusScope === 'closed') {
            domain.push(["stage_id", "in", CLOSED_STAGES]);
        }

        return domain;
    }

    async function searchTicketsOdoo(query, stage = null, statusScope = 'open', assignedToMe = false, offset = 0) {
        try {
            const domain = await buildTicketDomain(query, stage, statusScope, assignedToMe);

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

    async function countTicketsOdoo(query, stage = null, statusScope = 'open', assignedToMe = false) {
        try {
            const domain = await buildTicketDomain(query, stage, statusScope, assignedToMe);
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
}

// Inicialização Robust
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatbot);
} else {
    initChatbot();
}
