/**
 * ==========================================================================
 * Meu Dia - Aplicação de Produtividade Pessoal (script.js)
 * Funcionalidades: Persistência LocalStorage, Tema Claro/Escuro (Dark Mode),
 * Filtros, Progresso, Animações, Toasts e Confetes
 * ==========================================================================
 */

// Chaves do LocalStorage
const STORAGE_KEY = 'meu_dia_tarefas_lista';
const THEME_KEY = 'meu_dia_tema_preferido';

// Elementos Principais do DOM
const formTarefa = document.getElementById('form-tarefa');
const inputTarefa = document.getElementById('input-tarefa');
const listaTarefas = document.getElementById('lista-tarefas');
const mensagemVazia = document.getElementById('mensagem-vazia');
const btnTema = document.getElementById('btn-tema');

// Elementos de Informação e Progresso
const dataTexto = document.getElementById('data-texto');
const progressoTexto = document.getElementById('progresso-texto');
const progressoBarra = document.getElementById('progresso-barra');
const toastContainer = document.getElementById('toast-container');
const btnLimparConcluidas = document.getElementById('btn-limpar-concluidas');

// Filtros e Badges
const filtroBotoes = document.querySelectorAll('.filtro-btn');
const badgeTodas = document.getElementById('badge-todas');
const badgePendentes = document.getElementById('badge-pendentes');
const badgeConcluidas = document.getElementById('badge-concluidas');

// Canvas de Confete
const confettiCanvas = document.getElementById('confetti-canvas');
const ctxConfetti = confettiCanvas ? confettiCanvas.getContext('2d') : null;

// Estado da Aplicação
let tarefas = [];
let filtroAtual = 'todas'; // 'todas' | 'pendentes' | 'concluidas'

// --------------------------------------------------------------------------
// Gerenciamento de Tema (Modo Claro / Modo Escuro)
// --------------------------------------------------------------------------

/**
 * Inicializa o tema verificando a preferência salva no LocalStorage
 * ou detectando o padrão do sistema operacional do usuário.
 */
function inicializarTema() {
    const temaSalvo = localStorage.getItem(THEME_KEY);
    
    if (temaSalvo === 'dark' || temaSalvo === 'light') {
        aplicarTema(temaSalvo, false);
    } else {
        // Detecta preferência do sistema
        const prefereEscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        aplicarTema(prefereEscuro ? 'dark' : 'light', false);
    }

    // Ouvinte para alterações de tema do sistema operacional
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(THEME_KEY)) {
                aplicarTema(e.matches ? 'dark' : 'light', true);
            }
        });
    }
}

/**
 * Aplica o tema na tag <html> e atualiza acessibilidade do botão
 * @param {'light'|'dark'} tema 
 * @param {boolean} notificar
 */
function aplicarTema(tema, notificar = false) {
    document.documentElement.setAttribute('data-theme', tema);
    
    if (btnTema) {
        const proximoTema = tema === 'dark' ? 'claro' : 'escuro';
        btnTema.setAttribute('title', `Mudar para modo ${proximoTema}`);
        btnTema.setAttribute('aria-label', `Mudar para modo ${proximoTema}`);
    }

    if (notificar) {
        mostrarToast(
            tema === 'dark' ? 'Modo Escuro ativado 🌙' : 'Modo Claro ativado ☀️', 
            'info'
        );
    }
}

/**
 * Alterna entre os temas Claro e Escuro e persiste a escolha no LocalStorage
 */
function alternarTema() {
    const temaAtual = document.documentElement.getAttribute('data-theme') || 'light';
    const novoTema = temaAtual === 'dark' ? 'light' : 'dark';
    
    localStorage.setItem(THEME_KEY, novoTema);
    aplicarTema(novoTema, true);
}

// --------------------------------------------------------------------------
// Manipulação de Datas e Métricas
// --------------------------------------------------------------------------

/**
 * Formata e exibe a data atual em português no cabeçalho
 */
function atualizarDataAtual() {
    if (!dataTexto) return;
    const agora = new Date();
    const opcoes = { weekday: 'long', day: 'numeric', month: 'long' };
    const dataFormatada = agora.toLocaleDateString('pt-BR', opcoes);
    // Capitaliza a primeira letra
    dataTexto.textContent = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
}

/**
 * Carrega e migra tarefas salvas no LocalStorage com retrocompatibilidade
 */
function carregarTarefas() {
    try {
        const dadosSalvos = localStorage.getItem(STORAGE_KEY);
        if (dadosSalvos) {
            const parsed = JSON.parse(dadosSalvos);
            if (Array.isArray(parsed)) {
                tarefas = parsed.map((item, index) => {
                    if (typeof item === 'string') {
                        return {
                            id: Date.now() + index,
                            texto: item,
                            concluida: false,
                            criadaEm: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        };
                    }
                    return item;
                });
            }
        }
    } catch (erro) {
        console.error('Falha ao ler dados do LocalStorage:', erro);
        tarefas = [];
    }

    atualizarInterface();
}

/**
 * Salva as tarefas no LocalStorage
 */
function salvarTarefas() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tarefas));
    } catch (erro) {
        console.error('Falha ao salvar no LocalStorage:', erro);
        mostrarToast('Erro ao salvar tarefas localmente.', 'erro');
    }
}

/**
 * Atualiza todas as métricas, contadores e lista na interface
 */
function atualizarInterface() {
    atualizarProgresso();
    atualizarBadges();
    renderizarLista();
}

/**
 * Atualiza o indicador visual de progresso e barra percentual
 */
function atualizarProgresso() {
    const total = tarefas.length;
    const concluidas = tarefas.filter(t => t.concluida).length;
    const porcentagem = total === 0 ? 0 : Math.round((concluidas / total) * 100);

    progressoTexto.textContent = `${concluidas} de ${total} concluída${concluidas === 1 ? '' : 's'}`;
    progressoBarra.style.width = `${porcentagem}%`;

    // Dispara confetes se todas as tarefas forem concluídas
    if (total > 0 && concluidas === total) {
        dispararConfetes();
    }
}

/**
 * Atualiza os contadores em cada botão de filtro
 */
function atualizarBadges() {
    const total = tarefas.length;
    const concluidas = tarefas.filter(t => t.concluida).length;
    const pendentes = total - concluidas;

    if (badgeTodas) badgeTodas.textContent = total;
    if (badgePendentes) badgePendentes.textContent = pendentes;
    if (badgeConcluidas) badgeConcluidas.textContent = concluidas;
}

/**
 * Renderiza as tarefas no DOM de acordo com o filtro atual
 */
function renderizarLista() {
    listaTarefas.innerHTML = '';

    const tarefasFiltradas = tarefas.filter(tarefa => {
        if (filtroAtual === 'pendentes') return !tarefa.concluida;
        if (filtroAtual === 'concluidas') return tarefa.concluida;
        return true;
    });

    if (tarefasFiltradas.length === 0) {
        mensagemVazia.classList.add('visivel');
    } else {
        mensagemVazia.classList.remove('visivel');
    }

    tarefasFiltradas.forEach(tarefa => {
        const itemLi = document.createElement('li');
        itemLi.className = `tarefa-item ${tarefa.concluida ? 'concluida' : ''}`;
        itemLi.dataset.id = tarefa.id;

        // Checkbox Circular
        const btnCheckbox = document.createElement('button');
        btnCheckbox.type = 'button';
        btnCheckbox.className = 'checkbox-btn';
        btnCheckbox.setAttribute('aria-label', tarefa.concluida ? 'Marcar como pendente' : 'Marcar como concluída');
        btnCheckbox.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;

        btnCheckbox.addEventListener('click', (e) => {
            e.stopPropagation();
            alternarConclusao(tarefa.id);
        });

        // Conteúdo da Tarefa (Texto e Hora)
        const wrapperConteudo = document.createElement('div');
        wrapperConteudo.className = 'tarefa-conteudo';

        const spanTexto = document.createElement('span');
        spanTexto.className = 'tarefa-texto';
        spanTexto.textContent = tarefa.texto; // Previne injeção XSS

        const spanHora = document.createElement('span');
        spanHora.className = 'tarefa-hora';
        spanHora.textContent = tarefa.criadaEm ? `Adicionada às ${tarefa.criadaEm}` : '';

        wrapperConteudo.appendChild(spanTexto);
        if (tarefa.criadaEm) {
            wrapperConteudo.appendChild(spanHora);
        }

        wrapperConteudo.addEventListener('click', () => {
            alternarConclusao(tarefa.id);
        });

        // Botão Vermelho de Excluir
        const btnExcluir = document.createElement('button');
        btnExcluir.type = 'button';
        btnExcluir.className = 'btn-excluir';
        btnExcluir.setAttribute('aria-label', `Excluir tarefa: ${tarefa.texto}`);
        btnExcluir.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>Excluir</span>
        `;

        btnExcluir.addEventListener('click', (e) => {
            e.stopPropagation();
            removerTarefaComAnimacao(itemLi, tarefa.id);
        });

        // Monta o item
        itemLi.appendChild(btnCheckbox);
        itemLi.appendChild(wrapperConteudo);
        itemLi.appendChild(btnExcluir);

        listaTarefas.appendChild(itemLi);
    });
}

/**
 * Adiciona uma nova tarefa à lista
 */
function adicionarTarefa() {
    const texto = inputTarefa.value.trim();

    if (texto === '') {
        inputTarefa.classList.remove('shake');
        void inputTarefa.offsetWidth;
        inputTarefa.classList.add('shake');
        inputTarefa.focus();

        mostrarToast('Por favor, digite uma tarefa antes de adicionar!', 'alerta');
        alert('Por favor, digite uma tarefa antes de adicionar!');
        return;
    }

    const agora = new Date();
    const horaFormatada = agora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const novaTarefa = {
        id: Date.now(),
        texto: texto,
        concluida: false,
        criadaEm: horaFormatada
    };

    tarefas.unshift(novaTarefa);
    salvarTarefas();
    atualizarInterface();

    inputTarefa.value = '';
    inputTarefa.focus();

    mostrarToast('Tarefa adicionada com sucesso!', 'sucesso');
}

/**
 * Alterna o estado de conclusão de uma tarefa
 */
function alternarConclusao(id) {
    const tarefa = tarefas.find(t => t.id === id);
    if (tarefa) {
        tarefa.concluida = !tarefa.concluida;
        salvarTarefas();
        atualizarInterface();
    }
}

/**
 * Remove uma tarefa com transição animada
 */
function removerTarefaComAnimacao(elementoLi, id) {
    elementoLi.classList.add('removendo');
    elementoLi.addEventListener('transitionend', () => {
        tarefas = tarefas.filter(t => t.id !== id);
        salvarTarefas();
        atualizarInterface();
        mostrarToast('Tarefa excluída.', 'erro');
    }, { once: true });
}

/**
 * Remove todas as tarefas já marcadas como concluídas
 */
function limparConcluidas() {
    const concluidas = tarefas.filter(t => t.concluida).length;
    if (concluidas === 0) {
        mostrarToast('Nenhuma tarefa concluída para limpar.', 'alerta');
        return;
    }

    tarefas = tarefas.filter(t => !t.concluida);
    salvarTarefas();
    atualizarInterface();
    mostrarToast(`${concluidas} tarefa(s) concluída(s) removida(s).`, 'sucesso');
}

/**
 * Exibe notificações flutuantes modernas (Toast)
 */
function mostrarToast(mensagem, tipo = 'info') {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;

    let icone = '📌';
    if (tipo === 'sucesso') icone = '✓';
    if (tipo === 'alerta') icone = '⚠️';
    if (tipo === 'erro') icone = '🗑️';

    toast.innerHTML = `<span>${icone}</span> <span>${mensagem}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3200);
}

/**
 * Efeito visual de confete ao completar todas as tarefas
 */
function dispararConfetes() {
    if (!confettiCanvas || !ctxConfetti) return;

    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const particulas = [];
    const cores = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

    for (let i = 0; i < 60; i++) {
        particulas.push({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.7) * 14,
            tamanho: Math.random() * 8 + 4,
            cor: cores[Math.floor(Math.random() * cores.length)],
            rotacao: Math.random() * 360,
            velocidadeRotacao: (Math.random() - 0.5) * 10,
            gravidade: 0.35,
            vida: 1
        });
    }

    function animar() {
        ctxConfetti.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        let ativas = 0;

        particulas.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravidade;
            p.rotacao += p.velocidadeRotacao;
            p.vida -= 0.015;

            if (p.vida > 0) {
                ativas++;
                ctxConfetti.save();
                ctxConfetti.translate(p.x, p.y);
                ctxConfetti.rotate((p.rotacao * Math.PI) / 180);
                ctxConfetti.fillStyle = p.cor;
                ctxConfetti.globalAlpha = Math.max(0, p.vida);
                ctxConfetti.fillRect(-p.tamanho / 2, -p.tamanho / 2, p.tamanho, p.tamanho);
                ctxConfetti.restore();
            }
        });

        if (ativas > 0) {
            requestAnimationFrame(animar);
        } else {
            ctxConfetti.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        }
    }

    animar();
}

// -------------------------------------------------------------
// Registro de Eventos e Inicialização
// -------------------------------------------------------------

// Envio do formulário
formTarefa.addEventListener('submit', (e) => {
    e.preventDefault();
    adicionarTarefa();
});

// Alternador de Tema (Dark / Light)
if (btnTema) {
    btnTema.addEventListener('click', alternarTema);
}

// Filtros interativos
filtroBotoes.forEach(btn => {
    btn.addEventListener('click', () => {
        filtroBotoes.forEach(b => b.classList.remove('ativo'));
        btn.classList.add('ativo');
        filtroAtual = btn.dataset.filtro;
        renderizarLista();
    });
});

// Botão de limpar tarefas concluídas
if (btnLimparConcluidas) {
    btnLimparConcluidas.addEventListener('click', limparConcluidas);
}

// Ajuste responsivo do canvas de confetes
window.addEventListener('resize', () => {
    if (confettiCanvas) {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }
});

// Inicialização completa ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    inicializarTema();
    atualizarDataAtual();
    carregarTarefas();
});
