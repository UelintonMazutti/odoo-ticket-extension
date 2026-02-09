document.addEventListener("keydown", function (e) {
  const baseURL = location.origin;

  // Função auxiliar para fechar o modal
  function closeModal() {
    const overlay = document.getElementById("odoo-ticket-modal-overlay");
    if (overlay) overlay.remove();
  }

  // Função para criar o modal
  function createModal(placeholderText, onEnter) {
    if (document.getElementById("odoo-ticket-modal-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "odoo-ticket-modal-overlay";

    // Fechar ao clicar fora
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    const content = document.createElement("div");
    content.id = "odoo-ticket-modal-content";

    const input = document.createElement("input");
    input.id = "odoo-ticket-search-input";
    input.type = "text"; // Changed to text to allow flexible input if needed, though ticket is number
    input.placeholder = placeholderText;
    input.autocomplete = "off";
    input.autofocus = true;

    const resultsList = document.createElement("ul");
    resultsList.id = "odoo-ticket-results-list";

    content.appendChild(input);
    content.appendChild(resultsList);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    input.focus();

    // Eventos do Input
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        const value = input.value.trim();
        if (value) {
          onEnter(value, input, resultsList);
        }
      } else if (ev.key === "Escape") {
        closeModal();
      }
    });

    return { input, resultsList };
  }

  // Ctrl + Espaço e Ctrl + Alt + Espaço → Buscar ticket (Modal) por ID
  if (
    e.code === "Space" &&
    (
      (e.ctrlKey && !e.shiftKey && !e.altKey) ||     // Ctrl + Espaço
      (e.ctrlKey && !e.shiftKey && e.altKey)         // Ctrl + Alt + Espaço
    )
  ) {
    e.preventDefault();

    const { input, resultsList } = createModal("Digite o ID do ticket...", async (term, inp, list) => {
      list.innerHTML = '<li class="odoo-ticket-result-item">Buscando...</li>';

      // Ensure term is a number for ID search
      const ticketId = parseInt(term);
      if (isNaN(ticketId)) {
        list.innerHTML = '<li class="odoo-ticket-result-item">Por favor, digite um número válido.</li>';
        return;
      }

      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        list.innerHTML = '<li class="odoo-ticket-result-item">Erro: CSRF Token não encontrado.</li>';
        return;
      }

      // Domain: search by ID
      const domain = [["id", "=", ticketId]];

      try {
        const response = await fetch(`${location.origin}/web/dataset/call_kw/helpdesk.ticket/search_read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: {
              model: "helpdesk.ticket",
              method: "search_read",
              args: [],
              kwargs: {
                domain: domain,
                fields: ["id", "name", "ticket_ref", "partner_id", "stage_id", "user_id", "create_date", "x_studio_prioridade"],
                limit: 1 // ID is unique
              }
            },
            id: Math.floor(Math.random() * 1000000000)
          })
        });
        const result = await response.json();
        if (result.error) {
          console.error("RPC Error:", result.error);
          list.innerHTML = '<li class="odoo-ticket-result-item">Erro na busca.</li>';
          return;
        }
        renderResults(result.result || [], list);
      } catch (err) {
        console.error("Fetch error:", err);
        list.innerHTML = '<li class="odoo-ticket-result-item">Erro na conexão.</li>';
      }
    });
  }





  // Ctrl + Shift + M → Ver meus tickets
  if (e.ctrlKey && e.shiftKey && e.code === "KeyM") {

    // Limpa LocalStorage, SessionStorage e IndexedDB (se tiver)
    localStorage.clear();
    sessionStorage.clear();

    e.preventDefault();
    window.open(`${baseURL}/odoo/my-tickets?view_type=kanban`, "_blank");
  }

  // Ctrl + Shift + X → Criar novo Ticket
  if (e.ctrlKey && e.shiftKey && e.code === "KeyX") {
    e.preventDefault();
    window.open(`${baseURL}/odoo/my-tickets/new`, "_blank");
  }

  // Ctrl + Shift + C → Copiar informações do ticket, solicitantes e cliente
  if (e.ctrlKey && e.shiftKey && e.code === "KeyC") {
    e.preventDefault();

    const safeText = (selector) => {
      const el = document.querySelector(selector);
      return el?.textContent?.trim() || "-";
    };

    const safeInput = (id) => {
      const el = document.getElementById(id);
      return el?.value?.trim() || "-";
    };

    // Título do ticket
    const tituloCompleto = document.querySelector("span.min-w-0.text-truncate")?.textContent.trim() || "-";

    // URL formatada com base no ID do ticket
    const paginaAtual = (() => {
      const baseURL = location.origin;
      const match = window.location.href.match(/(\d+)(?!.*\d)/); // último número da URL
      return match ? `${baseURL}/odoo/all-tickets/${match[1]}` : window.location.href;
    })();

    // Pegando solicitantes
    const solicitantes = Array.from(document.querySelectorAll('div[name="x_studio_solicitantes"] .o_tag[title]'))
      .map(e => e.getAttribute('title')?.trim())
      .filter(Boolean)
      .join(", ") || "-";

    // Pegando cliente
    const cliente =
      document.querySelector('div[name="partner_id"] input[type="text"]')?.value.trim() ||
      document.querySelector('div[name="partner_id"] .o_field_many2one_selection')?.textContent.trim() ||
      "-";

    const el = document.querySelector('div[name="stage_id"] .o_arrow_button_current');
    let estagioRaw = el ? el.textContent.trim() : "-";
    let estagio;

    const matchN = estagioRaw.match(/^(.*?\bN[123])(?:\b|[^a-zA-Z].*)?$/i);
    if (matchN) {
      estagio = matchN[1].trim();
    } else {
      const matchNonly = estagioRaw.match(/^(.*?)\bN\b/i);
      if (matchNonly) {
        estagio = matchNonly[1].trim();
      } else {
        estagio = estagioRaw.replace(/\s*\d.*$/, "").trim();
      }
    }

    const htmlContent = `
<div>
  Ticket: <a href="${paginaAtual}" target="_blank" rel="noopener noreferrer">${tituloCompleto}</a><br>
  Solicitantes: ${solicitantes}<br>
  Cliente: ${cliente}<br>
  Estágio: ${estagio}<br>
  Criado em: ${safeText('div[name="create_date"] span')}<br>
  Atribuído a: ${safeInput('user_id_0')}<br>
  Prioridade: ${document.querySelector('div[name="x_studio_prioridade"] .o_arrow_button_current')?.textContent.trim() || "-"}
</div>
`.trim();

    const plainTextContent = `
Ticket: ${tituloCompleto}
Link: ${paginaAtual}
Solicitantes: ${solicitantes}
Cliente: ${cliente}
Estágio: ${estagio}
Criado em: ${safeText('div[name="create_date"] span')}
Atribuído a: ${safeInput('user_id_0')}
Prioridade: ${document.querySelector('div[name="x_studio_prioridade"] .o_arrow_button_current')?.textContent.trim() || "-"}
`.trim();

    if (window.ClipboardItem) {
      const clipboardItems = [
        new ClipboardItem({
          "text/html": new Blob([htmlContent], { type: "text/html" }),
          "text/plain": new Blob([plainTextContent], { type: "text/plain" })
        })
      ];
      navigator.clipboard.write(clipboardItems).catch(() => {
        navigator.clipboard.writeText(plainTextContent).catch(() => { });
      });
    } else {
      navigator.clipboard.writeText(plainTextContent).catch(() => { });
    }
  }

  // --- Client Search Implementation ---

  // Helper to get CSRF token from page
  function getCsrfToken() {
    const match = document.documentElement.innerHTML.match(/csrf_token:\s*"([^"]+)"/);
    return match ? match[1] : null;
  }

  // Search tickets via RPC
  async function searchTickets(term) {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      console.error("CSRF Token not found");
      return [];
    }

    const domain = [
      "&",
      "|", "|",
      ["partner_id", "ilike", term],
      ["x_studio_solicitantes", "ilike", term],
      ["x_studio_sigla_cliente", "ilike", term],
      ["stage_id.name", "not in", ["Disponível Para Suporte", "Notificado", "Encerrado", "Cancelado/Recusado"]]
    ];

    try {
      const response = await fetch(`${location.origin}/web/dataset/call_kw/helpdesk.ticket/search_read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "call",
          params: {
            model: "helpdesk.ticket",
            method: "search_read",
            args: [],
            kwargs: {
              domain: domain,
              fields: ["id", "name", "ticket_ref", "partner_id", "stage_id", "user_id", "create_date", "x_studio_prioridade"],
              limit: 0,
              order: "create_date desc"
            }
          },
          id: Math.floor(Math.random() * 1000000000)
        })
      });
      const result = await response.json();
      if (result.error) {
        console.error("Odoo RPC Error:", result.error);
        return [];
      }
      return result.result || [];
    } catch (err) {
      console.error("Fetch error:", err);
      return [];
    }
  }

  // Render results to list
  function renderResults(tickets, list) {
    const content = document.getElementById("odoo-ticket-modal-content");

    // Remove existing header if present/updating
    const existingHeader = content.querySelector(".odoo-ticket-modal-header");
    if (existingHeader) existingHeader.remove();

    // Create Header
    const header = document.createElement("div");
    header.className = "odoo-ticket-modal-header";
    header.innerHTML = `
        <span>Resultados: ${tickets.length} ticket(s)</span>
        <span class="odoo-ticket-close-btn">&times;</span>
    `;

    // Close button logic
    header.querySelector(".odoo-ticket-close-btn").addEventListener("click", closeModal);

    // Insert header at top
    content.insertBefore(header, content.firstChild);

    list.innerHTML = "";
    if (tickets.length === 0) {
      const li = document.createElement("li");
      li.className = "odoo-ticket-result-item";
      li.textContent = "Nenhum ticket encontrado.";
      list.appendChild(li);
      return;
    }

    tickets.forEach(ticket => {
      const li = document.createElement("li");
      li.className = "odoo-ticket-result-item";

      const partnerName = Array.isArray(ticket.partner_id) ? ticket.partner_id[1] : (ticket.partner_id || "-");
      const stageName = Array.isArray(ticket.stage_id) ? ticket.stage_id[1] : (ticket.stage_id || "-");
      const userName = Array.isArray(ticket.user_id) ? ticket.user_id[1] : "-";

      // Use ticket_ref if available, fallback to ID
      const ref = ticket.ticket_ref || `#${ticket.id}`;

      // Date formatting: "YYYY-MM-DD HH:mm:ss" -> "DD/MM/YYYY HH:mm"
      let dateStr = "";
      if (ticket.create_date) {
        const date = new Date(ticket.create_date.replace(" ", "T") + "Z"); // Accessing UTC usually? Or assume local?
        // Odoo returns UTC usually. Let's assume browser local conversion.
        // If date string is simple, Date.parse works.
        // But manually:
        try {
          // Simple split if timezone is tricky
          const [ymd, hms] = ticket.create_date.split(" ");
          const [y, m, d] = ymd.split("-");
          dateStr = `${d}/${m}/${y} ${hms}`;
        } catch (e) {
          dateStr = ticket.create_date;
        }
      }

      li.innerHTML = `
            <div class="odoo-ticket-result-row-main">
                <span class="odoo-ticket-ref">${ref}</span>
                <span class="odoo-ticket-name">${ticket.name}</span>
            </div>
            <div class="odoo-ticket-result-row-meta">
                <span title="Cliente"><i class="fa fa-user"></i> ${partnerName}</span>
                <span title="Estágio"><i class="fa fa-tag"></i> ${stageName}</span>
                <span title="Atribuído"><i class="fa fa-briefcase"></i> ${userName}</span>
                <span title="Data"><i class="fa fa-clock-o"></i> ${dateStr}</span>
            </div>
        `;

      li.addEventListener("click", () => {
        // Logic to open ticket
        window.open(`${location.origin}/odoo/all-tickets/${ticket.id}`, "_blank");
        closeModal();
      });

      list.appendChild(li);
    });
  }

  // Ctrl + Shift + K → Busca por Cliente
  if (e.ctrlKey && e.shiftKey && e.code === "KeyK") {
    e.preventDefault();

    // We reuse createModal but with custom onEnter
    const { input, resultsList } = createModal("Pesquisar Cliente/Solicitante...", async (term, inp, list) => {
      list.innerHTML = '<li class="odoo-ticket-result-item">Buscando...</li>';
      const results = await searchTickets(term);
      renderResults(results, list);
    });
  }

  // Ctrl + Shift + F → Busca por Descrição/Assunto
  if (e.ctrlKey && e.shiftKey && e.code === "KeyF") {
    e.preventDefault();

    const { input, resultsList } = createModal("Pesquisar por Assunto/Descrição...", async (term, inp, list) => {
      list.innerHTML = '<li class="odoo-ticket-result-item">Buscando...</li>';

      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        list.innerHTML = '<li class="odoo-ticket-result-item">Erro: CSRF Token não encontrado.</li>';
        return;
      }

      const domain = [
        "|",
        ["name", "ilike", term],
        ["description", "ilike", term]
      ];

      try {
        const response = await fetch(`${location.origin}/web/dataset/call_kw/helpdesk.ticket/search_read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: {
              model: "helpdesk.ticket",
              method: "search_read",
              args: [],
              kwargs: {
                domain: domain,
                // Note: need to manually ask for ticket_ref here too if we want consistecy, though renderResults might fallback.
                // It's safer to use the same fields list.
                fields: ["id", "name", "ticket_ref", "partner_id", "stage_id", "user_id", "create_date", "x_studio_prioridade"],
                limit: 20,
                order: "create_date desc"
              }
            },
            id: Math.floor(Math.random() * 1000000000)
          })
        });
        const result = await response.json();
        if (result.error) {
          console.error("RPC Error:", result.error);
          list.innerHTML = '<li class="odoo-ticket-result-item">Erro na busca.</li>';
          return;
        }
        renderResults(result.result || [], list);
      } catch (err) {
        console.error("Fetch error:", err);
        list.innerHTML = '<li class="odoo-ticket-result-item">Erro na conexão.</li>';
      }
    });
  }
});

window.addEventListener("load", function () {
  const ticketToSearch = sessionStorage.getItem("odooTicketToSearch");
  if (!ticketToSearch) return;

  sessionStorage.removeItem("odooTicketToSearch");

  function waitForElm(selector) {
    return new Promise(resolve => {
      if (document.querySelector(selector)) return resolve(document.querySelector(selector));
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  function simulateRealClick(el) {
    if (!el) return;
    ['pointerover', 'pointerdown', 'mousedown', 'mouseup', 'click'].forEach(type => {
      const evt = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window, button: 0 });
      el.dispatchEvent(evt);
    });
  }

  async function clickTicket(ticketNumber) {
    await waitForElm('.o_data_row');
    const rows = document.querySelectorAll('.o_data_row');
    for (const row of rows) {
      if (row.textContent.includes(ticketNumber)) {
        function escapeXpathString(str) {
          if (str.indexOf('"') === -1) return '"' + str + '"';
          if (str.indexOf("'") === -1) return "'" + str + "'";
          return "concat('" + str.replace(/'/g, "',\"'\",'") + "')";
        }

        const escapedTicket = escapeXpathString(ticketNumber);
        const xpathResult = document.evaluate(".//*[text()[normalize-space()=" + escapedTicket + "]]", row, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const target = xpathResult.singleNodeValue;

        if (target) simulateRealClick(target);
        else simulateRealClick(row);
        return;
      }
    }
  }

  const trySearch = () => {
    const filterCloseButton = document.querySelector(".o_searchview_facet .o_facet_remove");
    const searchInput = document.querySelector(".o_searchview_input");

    if (filterCloseButton) filterCloseButton.click();
    if (searchInput) {
      searchInput.value = ticketToSearch;
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));

      const enterEvent = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
        code: "Enter",
        which: 13,
        keyCode: 13
      });
      searchInput.dispatchEvent(enterEvent);

      setTimeout(() => {
        clickTicket(ticketToSearch);
      }, 300);
    } else {
      setTimeout(trySearch, 60);
    }
  };

  trySearch();
});

// Listener dedicado para Busca Avançada com CAPTURE: TRUE para garantir que o Odoo não bloqueie
document.addEventListener("keydown", function (e) {
  // Ctrl + Shift + F → Busca Avançada
  if (e.ctrlKey && e.shiftKey && e.code === "KeyF") {
    console.log("[OdooExt] Ctrl+Shift+F detected (Capture Mode)!");

    // Importante: Parar propagação para que o Odoo não tente fazer nada com isso
    e.stopPropagation();
    e.preventDefault();

    if (document.getElementById("odoo-ticket-advanced-search-input")) return;

    // --- Criação do Input de Busca Avançada ---
    const input = document.createElement("input");
    input.id = "odoo-ticket-advanced-search-input";
    input.type = "text";
    input.placeholder = "Busca Avançada (Título, Descrição, Rotina, Docs, Resumo)...";
    input.autofocus = true;

    Object.assign(input.style, {
      position: "fixed",
      top: "50px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "2147483647",
      width: "600px",
      padding: "15px",
      fontSize: "18px",
      boxShadow: "0 0 20px rgba(0,0,0,0.5)",
      border: "2px solid #714B67",
      borderRadius: "8px",
      outline: "none",
      backgroundColor: "white",
      color: "#333"
    });

    // --- Função para fazer a chamada RPC ao Odoo ---
    // (Mesma lógica de antes)
    const searchOdoo = async (term) => {
      const baseURL = location.origin;
      const model = "helpdesk.ticket";
      const method = "search_read";

      const domain = [
        "|", "|", "|", "|", "|", "|",
        ["name", "ilike", term],
        ["description", "ilike", term],
        ["x_studio_ltima_rotina", "ilike", term],
        ["x_studio_documentao_interna", "ilike", term],
        ["x_studio_documentao_externa", "ilike", term],
        ["x_studio_suporte", "ilike", term],
        ["x_studio_resumo", "ilike", term]
      ];

      const fields = ["id", "name", "stage_id", "partner_id", "user_id"];

      const payload = {
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: model,
          method: method,
          args: [domain, fields],
          kwargs: { limit: 20, context: { lang: "pt_BR" } },
        },
        id: new Date().getTime(),
      };

      try {
        const response = await fetch(`${baseURL}/web/dataset/call_kw/${model}/${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (result.error) {
          console.error("Erro Odoo RPC:", result.error);
          alert("Erro na busca: " + result.error.data.message);
          return [];
        }
        return result.result;
      } catch (err) {
        console.error("Erro na requisição:", err);
        alert("Erro de conexão ao buscar tickets.");
        return [];
      }
    };

    // --- Função para exibir os resultados ---
    const showResults = (tickets) => {
      const oldModal = document.getElementById("odoo-search-results-modal");
      if (oldModal) oldModal.remove();

      if (!tickets || tickets.length === 0) {
        const toast = document.createElement("div");
        toast.innerText = "Nenhum ticket encontrado.";
        Object.assign(toast.style, {
          position: "fixed", bottom: "20px", right: "20px",
          backgroundColor: "#dc3545", color: "white", padding: "10px 20px",
          borderRadius: "5px", zIndex: "2147483647", boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
        return;
      }

      const modal = document.createElement("div");
      modal.id = "odoo-search-results-modal";
      Object.assign(modal.style, {
        position: "fixed", top: "80px", left: "50%", transform: "translateX(-50%)",
        width: "600px", maxHeight: "80vh", backgroundColor: "white",
        borderRadius: "8px", boxShadow: "0 10px 25px rgba(0,0,0,0.3)", zIndex: "2147483647",
        display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid #ddd",
        fontFamily: "system-ui, -apple-system, sans-serif"
      });

      const header = document.createElement("div");
      header.innerText = `Resultados: ${tickets.length} ticket(s)`;
      Object.assign(header.style, {
        padding: "15px", backgroundColor: "#714B67", color: "white",
        fontWeight: "bold", fontSize: "16px", display: "flex", justifyContent: "space-between", alignItems: "center"
      });

      const closeBtn = document.createElement("span");
      closeBtn.innerText = "×";
      closeBtn.style.cursor = "pointer";
      closeBtn.style.fontSize = "24px";
      closeBtn.onclick = () => modal.remove();
      header.appendChild(closeBtn);
      modal.appendChild(header);

      const list = document.createElement("div");
      Object.assign(list.style, { overflowY: "auto", padding: "10px", flex: "1" });

      tickets.forEach(t => {
        const item = document.createElement("div");
        Object.assign(item.style, {
          padding: "10px", borderBottom: "1px solid #eee", cursor: "pointer", transition: "background 0.2s"
        });
        item.onmouseover = () => item.style.backgroundColor = "#f9f9f9";
        item.onmouseout = () => item.style.backgroundColor = "transparent";

        const cliente = Array.isArray(t.partner_id) ? t.partner_id[1] : "-";
        const estagio = Array.isArray(t.stage_id) ? t.stage_id[1] : "-";
        const responsavel = Array.isArray(t.user_id) ? t.user_id[1] : "-";

        item.innerHTML = `
          <div style="font-weight: bold; color: #333;">#${t.id} - ${t.name}</div>
          <div style="font-size: 13px; color: #666; margin-top: 4px;">
            <span style="display:inline-block; margin-right: 15px;">👤 ${cliente}</span>
            <span style="display:inline-block;">🏷️ ${estagio}</span>
            <span style="display:inline-block;">💼 ${responsavel}</span>
          </div>
        `;
        item.onclick = () => {
          modal.remove();
          window.open(`${location.origin}/odoo/all-tickets/${t.id}`, "_blank");
        };
        list.appendChild(item);
      });

      modal.appendChild(list);
      document.body.appendChild(modal);

      const escListener = (ev) => {
        if (ev.key === "Escape") {
          modal.remove();
          document.removeEventListener("keydown", escListener);
        }
      };
      document.addEventListener("keydown", escListener);
    };

    input.addEventListener("keydown", async function (ev) {
      if (ev.key === "Enter") {
        const term = input.value.trim();
        if (term.length < 3) {
          alert("Digite pelo menos 3 caracteres.");
          return;
        }
        input.disabled = true;
        input.placeholder = "Buscando...";
        try {
          const results = await searchOdoo(term);
          input.remove();
          showResults(results);
        } catch (e) {
          input.disabled = false;
          input.placeholder = "Tente novamente...";
          console.error(e);
        }
      } else if (ev.key === "Escape") {
        input.remove();
      }
    });

    document.body.appendChild(input);
    input.focus();
  }
}, true); // UseCapture = true para interceptar antes do Odoo

// Listener dedicado para Busca de Clientes (Ctrl + Shift + K)
document.addEventListener("keydown", function (e) {
  // Ctrl + Shift + K → Busca por Cliente
  if (e.ctrlKey && e.shiftKey && e.code === "KeyK") {
    console.log("[OdooExt] Ctrl+Shift+K detected (Capture Mode)!");

    e.stopPropagation();
    e.preventDefault();

    if (document.getElementById("odoo-ticket-client-search-input")) return;

    // --- Criação do Input de Busca Cliente ---
    const input = document.createElement("input");
    input.id = "odoo-ticket-client-search-input";
    input.type = "text";
    input.placeholder = "Busca Cliente (Nome, Solicitante, Sigla)...";
    input.autofocus = true;

    Object.assign(input.style, {
      position: "fixed",
      top: "50px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "2147483647",
      width: "600px",
      padding: "15px",
      fontSize: "18px",
      boxShadow: "0 0 20px rgba(0,0,0,0.5)",
      border: "2px solid #28a745", // Verde para diferenciar
      borderRadius: "8px",
      outline: "none",
      backgroundColor: "white",
      color: "#333"
    });

    // --- Função para fazer a chamada RPC ao Odoo ---
    const searchOdooClient = async (term) => {
      const baseURL = location.origin;
      const model = "helpdesk.ticket";
      const method = "search_read";

      // Busca em: partner_id, x_studio_solicitantes, x_studio_sigla_cliente
      // E exclui estágios específicos
      const domain = [
        "|", "|",
        ["partner_id", "ilike", term],
        ["x_studio_solicitantes", "ilike", term],
        ["x_studio_sigla_cliente", "ilike", term],

        // Exclusões de estágios
        ["stage_id", "!=", "Notificado"],
        ["stage_id", "!=", "Encerrado"],
        ["stage_id", "!=", "Cancelado/Recusado"],
        ["stage_id", "!=", "Disponível Para Suporte"]
      ];

      const fields = ["id", "name", "stage_id", "partner_id", "user_id", "x_studio_solicitantes"];

      const payload = {
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: model,
          method: method,
          args: [domain, fields],
          kwargs: { limit: 20, context: { lang: "pt_BR" } },
        },
        id: new Date().getTime(),
      };

      try {
        const response = await fetch(`${baseURL}/web/dataset/call_kw/${model}/${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (result.error) {
          console.error("Erro Odoo RPC:", result.error);
          alert("Erro na busca: " + result.error.data.message);
          return [];
        }
        return result.result;
      } catch (err) {
        console.error("Erro na requisição:", err);
        alert("Erro de conexão ao buscar tickets.");
        return [];
      }
    };

    // --- Função para exibir os resultados ---
    const showResults = (tickets) => {
      const oldModal = document.getElementById("odoo-client-search-results-modal");
      if (oldModal) oldModal.remove();

      if (!tickets || tickets.length === 0) {
        const toast = document.createElement("div");
        toast.innerText = "Nenhum ticket encontrado para esse cliente.";
        Object.assign(toast.style, {
          position: "fixed", bottom: "20px", right: "20px",
          backgroundColor: "#dc3545", color: "white", padding: "10px 20px",
          borderRadius: "5px", zIndex: "2147483647", boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
        return;
      }

      const modal = document.createElement("div");
      modal.id = "odoo-client-search-results-modal";
      Object.assign(modal.style, {
        position: "fixed", top: "80px", left: "50%", transform: "translateX(-50%)",
        width: "600px", maxHeight: "80vh", backgroundColor: "white",
        borderRadius: "8px", boxShadow: "0 10px 25px rgba(0,0,0,0.3)", zIndex: "2147483647",
        display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid #ddd",
        fontFamily: "system-ui, -apple-system, sans-serif"
      });

      const header = document.createElement("div");
      header.innerText = `Clientes Encontrados: ${tickets.length} ticket(s)`;
      Object.assign(header.style, {
        padding: "15px", backgroundColor: "#28a745", color: "white",
        fontWeight: "bold", fontSize: "16px", display: "flex", justifyContent: "space-between", alignItems: "center"
      });

      const closeBtn = document.createElement("span");
      closeBtn.innerText = "×";
      closeBtn.style.cursor = "pointer";
      closeBtn.onclick = () => modal.remove();
      header.appendChild(closeBtn);
      modal.appendChild(header);

      const list = document.createElement("div");
      Object.assign(list.style, { overflowY: "auto", padding: "10px", flex: "1" });

      tickets.forEach(t => {
        const item = document.createElement("div");
        Object.assign(item.style, {
          padding: "10px", borderBottom: "1px solid #eee", cursor: "pointer", transition: "background 0.2s"
        });
        item.onmouseover = () => item.style.backgroundColor = "#f9f9f9";
        item.onmouseout = () => item.style.backgroundColor = "transparent";

        const cliente = Array.isArray(t.partner_id) ? t.partner_id[1] : "-";
        const solicitantes = t.x_studio_solicitantes || "-";
        const estagio = Array.isArray(t.stage_id) ? t.stage_id[1] : "-";

        item.innerHTML = `
          <div style="font-weight: bold; color: #333;">#${t.id} - ${t.name}</div>
          <div style="font-size: 13px; color: #666; margin-top: 4px;">
            <span style="display:block; margin-bottom: 2px;">👤 ${cliente} (${solicitantes})</span>
            <span style="display:inline-block;">🏷️ ${estagio}</span>
          </div>
        `;
        item.onclick = () => {
          // modal.remove();
          window.open(`${location.origin}/odoo/all-tickets/${t.id}`, "_blank");
        };
        list.appendChild(item);
      });

      modal.appendChild(list);
      document.body.appendChild(modal);

      const escListener = (ev) => {
        if (ev.key === "Escape") {
          modal.remove();
          document.removeEventListener("keydown", escListener);
        }
      };
      document.addEventListener("keydown", escListener);
    };

    input.addEventListener("keydown", async function (ev) {
      if (ev.key === "Enter") {
        const term = input.value.trim();
        if (term.length < 3) return alert("Digite pelo menos 3 caracteres.");
        input.disabled = true; input.placeholder = "Buscando cliente...";
        try {
          const results = await searchOdooClient(term);
          input.remove(); showResults(results);
        } catch (e) {
          input.disabled = false; input.placeholder = "Tente novamente...";
        }
      } else if (ev.key === "Escape") {
        input.remove();
      }
    });

    document.body.appendChild(input);
    input.focus();
  }
}, true);
