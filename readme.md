# Extensão Odoo Ticket Helper

Esta extensão turbina o seu uso do Odoo Helpdesk, adicionando atalhos rápidos e um **Assistente Inteligente (Chatbot)** para te ajudar a encontrar e gerenciar tickets.

## 🤖 Assistente Odoo (Novo!)

Acesse o **ícone de chat** no canto inferior direito para conversar com a IA.

**O que ele pode fazer:**
*   **Contar Tickets:** "Quantos tickets do cliente X estão em aberto?"
*   **Buscar Tickets:** "Me mostre os tickets da Sigla Y que estão em 'Análise'."
*   **Meus Tickets:** "Quais são meus tickets em 'Desenvolver'?"
*   **Resumo:** "Resuma o ticket #12345."

> **Configuração:** Para usar o Chatbot, você precisa configurar sua chave de API do Google Gemini. Clique no ícone da extensão > Opções (ou engrenagem).

---

## ⌨️ Atalhos de Teclado

Simplifique sua navegação com estes atalhos:

| Atalho | Função |
| :--- | :--- |
| **Ctrl + Espaço** | **Busca Rápida de Ticket**: Abre uma janela para digitar o ID do ticket e ir direto para ele. |
| **Ctrl + Shift + K** | **Busca por Cliente**: Pesquisa tickets por Nome do Cliente, Solicitante ou Sigla (exclui tickets fechados). |
| **Ctrl + Shift + F** | **Busca Avançada**: Pesquisa por Assunto ou Descrição do ticket. |
| **Ctrl + Shift + M** | **Meus Tickets**: Abre a lista de tickets atribuídos a você. |
| **Ctrl + Shift + C** | **Copiar Info**: Copia um resumo formatado do ticket aberto para a área de transferência. |
| **Ctrl + Shift + X** | **Novo Ticket**: Abre a tela de criação de um novo ticket. |
| **Ctrl + Shift + Espaço** | **Ir para Ticket do Link**: Se você tem um link copiado, tenta abrir o ticket correspondente. |

---

## 🛠️ Instalação

1.  Baixe/Clone este repositório.
2.  No Chrome/Edge/Brave, vá para `chrome://extensions`.
3.  Ative o **Modo do Desenvolvedor** (canto superior direito).
4.  Clique em **Carregar sem compactação** (ou "Load unpacked").
5.  Selecione a pasta do projeto.

## ⚙️ Configuração (Chatbot)

1.  Clique com o botão direito no ícone da extensão na barra de ferramentas.
2.  Selecione **Opções**.
3.  Insira sua **Google Gemini API Key**.
    *   *Se não tiver uma, crie gratuitamente no [Google AI Studio](https://aistudio.google.com/).*
4.  Escolha o modelo (ex: `gemini-1.5-flash` para rapidez, `gemini-1.5-pro` para raciocínio complexo).
5.  Clique em **Salvar**.

---

**Desenvolvido para agilizar o suporte no Odoo!** 🚀