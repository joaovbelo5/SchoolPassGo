// dashboard.js — Admin Dashboard Logic

const SHIFT_COLORS = {
    'Manhã':    { bar: '#f59e0b', badge: 'shift-badge-manha' },
    'Tarde':    { bar: '#3b82f6', badge: 'shift-badge-tarde' },
    'Noturno':  { bar: '#8b5cf6', badge: 'shift-badge-noturno' },
    'Noite':    { bar: '#8b5cf6', badge: 'shift-badge-noite' },
    'Integral': { bar: '#10b981', badge: 'shift-badge-integral' },
};
const DEFAULT_SHIFT_COLOR = '#64748b';

document.addEventListener('DOMContentLoaded', async () => {
    renderDate();
    await loadConfig();
    await loadStats();
    setInterval(loadStats, 30000);
});

function renderDate() {
    const now = new Date();
    const opts = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    const str = now.toLocaleDateString('pt-BR', opts);
    document.getElementById('heroDate').textContent = str.charAt(0).toUpperCase() + str.slice(1);
}

async function loadConfig() {
    try {
        const conf = await api('/api/config');
        if (conf.nome_instituicao) {
            if(document.getElementById('heroSchool')) document.getElementById('heroSchool').textContent = conf.nome_instituicao;
            if(document.getElementById('navTitulo')) document.getElementById('navTitulo').textContent = conf.nome_instituicao;
            document.title = conf.nome_instituicao + ' — Dashboard';
        }
        if (conf.logo_instituicao) {
            const wrap = document.getElementById('navBrandWrap');
            if(wrap) wrap.innerHTML = `<img src="${conf.logo_instituicao}" alt="Logo">`;
        }
    } catch (e) { /* no-op */ }
}

async function loadStats() {
    try {
        const s = await api('/api/dashboard');
        renderHeroStats(s);
        renderShiftCards(s.presencas_por_turno);
        renderInfoStats(s);
        renderRecentAccesses(s.ultimos_acessos);
    } catch (err) {
        console.error('Dashboard error:', err);
    }
}

function animateNumber(el, target) {
    const start = parseInt(el.textContent) || 0;
    if (start === target) return;
    const duration = 600;
    const startTime = performance.now();
    function step(now) {
        const elapsed = Math.min((now - startTime) / duration, 1);
        el.textContent = Math.round(start + (target - start) * elapsed);
        if (elapsed < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function renderHeroStats(s) {
    animateNumber(document.getElementById('statEntradas'), s.entradas_hoje);
    animateNumber(document.getElementById('statSaidas'), s.saidas_hoje);
    animateNumber(document.getElementById('statAlunos'), s.total_alunos);
    animateNumber(document.getElementById('statTurmas'), s.total_turmas);
}

function renderInfoStats(s) {
    animateNumber(document.getElementById('statSemFoto'), s.sem_foto);
    animateNumber(document.getElementById('statSemTelegram'), s.sem_telegram);
    animateNumber(document.getElementById('statOcorrencias'), s.total_ocorrencias);
}

function renderShiftCards(shifts) {
    const container = document.getElementById('shiftCards');
    
    const COLORS = {
        'Manh\u00e3': { bar: '#f59e0b', label: 'badge-yellow' },
        'Tarde':    { bar: '#3b82f6', label: 'badge-blue'   },
        'Noite':    { bar: '#8b5cf6', label: 'badge-gray'   },
        'Noturno':  { bar: '#8b5cf6', label: 'badge-gray'   },
        'Integral': { bar: '#16a34a', label: 'badge-green'  },
    };
    
    if (!shifts || shifts.length === 0) {
        container.innerHTML = `<div class="col-12 text-center py-4 text-muted"><i class="bi bi-moon-stars-fill me-2"></i>Nenhum acesso registrado hoje.</div>`;
        return;
    }

    container.innerHTML = shifts.map(tc => {
        const pct = tc.total > 0 ? Math.round((tc.presentes / tc.total) * 100) : 0;
        const c = COLORS[tc.turno] || { bar: '#64748b', label: 'badge-gray' };
        return `
        <div class="col-6 col-md-3">
            <div class="shift-card">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="${c.label}">${tc.turno}</span>
                    <span style="font-size:.75rem;color:var(--gray-400)">${pct}%</span>
                </div>
                <div class="stat-number" style="font-size:2rem">${tc.presentes}<span style="font-size:1rem;font-weight:500;color:var(--gray-400)"> / ${tc.total}</span></div>
                <div class="stat-label mb-2">alunos presentes</div>
                <div class="shift-progress">
                    <div class="shift-progress-bar" style="width:${pct}%;background:${c.bar}"></div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderRecentAccesses(accesses) {
    const container = document.getElementById('recentAccesses');

    if (!accesses || accesses.length === 0) {
        container.innerHTML = `<div class="text-center py-4 text-muted"><i class="bi bi-inbox me-2"></i>Nenhum acesso registrado.</div>`;
        return;
    }

    container.innerHTML = accesses.map(ac => {
        const dt = new Date(ac.data_hora);
        const time = isNaN(dt) ? '—' : dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const badge = ac.tipo === 'entrada'
            ? `<span class="badge-green">ENTRADA</span>`
            : `<span class="badge-yellow">SAÍDA</span>`;

        const initials = (ac.aluno_nome || '?').split(' ').slice(0, 2).map(w=>w[0]).join('');
        const avatar = ac.aluno_foto
            ? `<img src="${ac.aluno_foto}" class="student-avatar">`
            : `<div class="student-avatar-placeholder">${initials}</div>`;

        return `
        <div class="access-row">
            ${avatar}
            <span class="access-time">${time}</span>
            <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ac.aluno_nome}</div>
                <div style="font-size:.75rem;color:var(--gray-400)">${ac.aluno_turma} · ${ac.aluno_turno}</div>
            </div>
            ${badge}
        </div>`;
    }).join('');
}
