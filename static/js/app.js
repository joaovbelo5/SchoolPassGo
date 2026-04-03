// app.js - Common Utility Functions

function showAlert(message, type = 'success') {
    const typeMap = { success: 'success', danger: 'error', warning: 'warning', error: 'error' };
    const iconMap = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill' };
    const cls = typeMap[type] || 'success';
    const icon = iconMap[cls] || 'bi-info-circle-fill';
    const d = document.createElement('div');
    d.className = `spg-alert ${cls}`;
    d.innerHTML = `<i class="bi ${icon}"></i><span>${message}</span>`;
    const container = document.getElementById('alertContainer');
    if (container) {
        container.appendChild(d);
        setTimeout(() => d.remove(), 4000);
    }
}

async function api(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `Erro HTTP ${res.status}`);
    return data;
}

function formatDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d)) return isoString;
    return d.toLocaleString('pt-BR');
}

// Shared navbar config loader — call after DOMContentLoaded on any page
async function loadNavConfig() {
    try {
        const conf = await api('/api/config');
        if (conf.nome_instituicao) {
            const t = document.getElementById('navTitulo');
            if (t) t.textContent = conf.nome_instituicao;
            document.title = document.title.replace('SchoolPassGo', conf.nome_instituicao);
        }
        if (conf.logo_instituicao) {
            const wrap = document.getElementById('navBrandWrap');
            if (wrap) wrap.innerHTML = `<img src="${conf.logo_instituicao}" alt="Logo">`;
        }
    } catch(_) {}
}

// Auto-run navbar config on all pages that have navTitulo
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('navTitulo')) loadNavConfig();
});
