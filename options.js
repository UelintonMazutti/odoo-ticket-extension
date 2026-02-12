// Saves options to chrome.storage
function save_options() {
    var apiKey = document.getElementById('apiKey').value;
    var apiModel = document.getElementById('apiModel').value || "gemini-1.5-flash";

    chrome.storage.local.set({
        geminiApiKey: apiKey,
        geminiApiModel: apiModel
    }, function () {
        var status = document.getElementById('status');
        status.style.display = 'block';
        status.textContent = 'Configurações salvas!';

        setTimeout(function () {
            status.style.display = 'none';
            status.textContent = '';
        }, 2000);
    });
}

// Restores select box and checkbox state
function restore_options() {
    chrome.storage.local.get({
        geminiApiKey: '',
        geminiApiModel: 'gemini-1.5-flash'
    }, function (items) {
        document.getElementById('apiKey').value = items.geminiApiKey;
        document.getElementById('apiModel').value = items.geminiApiModel;
    });
}

async function check_models() {
    var apiKey = document.getElementById('apiKey').value;
    var listDiv = document.getElementById('modelList');

    if (!apiKey) {
        alert("Por favor, insira uma API Key primeiro.");
        return;
    }

    listDiv.style.display = 'block';
    listDiv.textContent = "Buscando modelos...";

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            const names = data.models.map(m => m.name.replace("models/", "")).join("\n");
            listDiv.textContent = "Modelos Disponíveis para sua chave:\n\n" + names;
        } else if (data.error) {
            listDiv.textContent = "Erro: " + data.error.message;
        } else {
            listDiv.textContent = "Nenhum modelo encontrado ou resposta inesperada.";
        }
    } catch (e) {
        listDiv.textContent = "Erro de conexão: " + e.message;
    }
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
document.getElementById('checkModels').addEventListener('click', check_models);
