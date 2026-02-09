document.addEventListener("keydown", function (e) {
  const baseURL = location.origin;

  // Ctrl + Espaço e Ctrl + Alt + Espaço → Buscar ticket na listagem
  if (
    e.code === "Space" &&
    (
      (e.ctrlKey && !e.shiftKey && !e.altKey) ||     // Ctrl + Espaço
      (e.ctrlKey && !e.shiftKey && e.altKey)         // Ctrl + Alt + Espaço
    )
  ) {
    e.preventDefault();
    if (document.getElementById("odoo-ticket-input")) return;

    const input = document.createElement("input");
    input.id = "odoo-ticket-input";
    input.type = "number";
    input.placeholder = "Digite o número do ticket...";
    input.autofocus = true;

    input.style.position = "fixed";
    input.style.top = "20px";
    input.style.left = "50%";
    input.style.transform = "translateX(-50%)";
    input.style.zIndex = "9999";
    input.style.width = "350px";
    input.style.padding = "10px";
    input.style.fontSize = "16px";
    input.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
    input.style.border = "1px solid #ccc";
    input.style.borderRadius = "8px";

    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        const ticketNumber = input.value.trim();
        input.remove();
        if (ticketNumber) {
          sessionStorage.setItem("odooTicketToSearch", ticketNumber);
          window.open(`${baseURL}/odoo/all-tickets`, "_blank");
        }
      } else if (ev.key === "Escape") {
        input.remove();
      }
    });

    document.body.appendChild(input);
    input.focus();
  }

  // Ctrl + F → Buscar ticket por texto na listagem
  if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === "KeyF") {
    e.preventDefault();
    if (document.getElementById("odoo-ticket-text-input")) return;

    const input = document.createElement("input");
    input.id = "odoo-ticket-text-input";
    input.type = "text";
    input.placeholder = "Digite o texto para buscar...";
    input.autofocus = true;

    input.style.position = "fixed";
    input.style.top = "20px";
    input.style.left = "50%";
    input.style.transform = "translateX(-50%)";
    input.style.zIndex = "9999";
    input.style.width = "350px";
    input.style.padding = "10px";
    input.style.fontSize = "16px";
    input.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
    input.style.border = "1px solid #ccc";
    input.style.borderRadius = "8px";

    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        const searchText = input.value.trim();
        input.remove();
        if (searchText) {
          sessionStorage.setItem("odooTicketToSearch", searchText);
          window.open(`${baseURL}/odoo/all-tickets`, "_blank");
        }
      } else if (ev.key === "Escape") {
        input.remove();
      }
    });

    document.body.appendChild(input);
    input.focus();
  }

  // Ctrl + Shift + Espaço → Redirecionar diretamente para o link do ticket
  if (e.ctrlKey && e.shiftKey && e.code === "Space") {
    e.preventDefault();
    if (document.getElementById("odoo-ticket-direct-input")) return;

    const input = document.createElement("input");
    input.id = "odoo-ticket-direct-input";
    input.type = "number";
    input.placeholder = "Digite o número do ticket (Link)...";
    input.autofocus = true;

    input.style.position = "fixed";
    input.style.top = "20px";
    input.style.left = "50%";
    input.style.transform = "translateX(-50%)";
    input.style.zIndex = "9999";
    input.style.width = "350px";
    input.style.padding = "10px";
    input.style.fontSize = "16px";
    input.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
    input.style.border = "1px solid #ccc";
    input.style.borderRadius = "8px";

    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        const ticketNumber = input.value.trim();
        input.remove();
        if (ticketNumber) {
          window.open(`${baseURL}/odoo/all-tickets/${ticketNumber}`, "_blank");
        }
      } else if (ev.key === "Escape") {
        input.remove();
      }
    });

    document.body.appendChild(input);
    input.focus();
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
        navigator.clipboard.writeText(plainTextContent).catch(() => {});
      });
    } else {
      navigator.clipboard.writeText(plainTextContent).catch(() => {});
    }
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
