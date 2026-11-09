/* Escritório dos agentes: cena 2D com a situação de cada agente (lida do Supabase a cada 30 s). */
(function () {
'use strict';
const AG = [
  {id: 'atendente', nome: 'Atendente', funcao: 'Conversa com os leads no WhatsApp e decide quem vai para o consultor.',
   cor: '#16a34a', escuro: '#0f7a35', int: 1, ini: 8 * 60, fim: 20 * 60 - 1, tela: 'chat', espera: 'Esperando mensagem de lead'},
  {id: 'monitor', nome: 'Monitor', funcao: 'Vigia o Atendente a cada 10 minutos e avisa a equipe se algo der errado.',
   cor: '#3b6fd8', escuro: '#2a52a6', int: 10, ini: 8 * 60, fim: 20 * 60 + 40, tela: 'grafico', espera: 'De olho no Atendente'},
  {id: 'validador', nome: 'Validador', funcao: 'Confere a cada 30 minutos se o Monitor está fazendo o trabalho direito.',
   cor: '#8b5cf6', escuro: '#6a3fd0', int: 30, ini: 8 * 60 + 10, fim: 21 * 60, tela: 'check', espera: 'De olho no Monitor'},
  {id: 'cerebro', nome: 'Cérebro', funcao: 'Estuda as conversas e propõe aprendizados para o Atendente.',
   cor: '#e0a43a', escuro: '#b57f1d', int: 15, ini: 8 * 60, fim: 21 * 60 + 30, tela: 'ideia', espera: 'Esperando conversas novas'},
];
const ROT = {trab: 'Trabalhando', plantao: 'De plantão', dorme: 'Dormindo', erro: 'Com erro', atraso: 'Atrasado', off: 'Desligado'};
const OLHO = {trab: '#7CFFB2', plantao: '#9fd8ff', erro: '#ff6b5e', atraso: '#ffc861', off: '#8a929a', dorme: '#8a929a'};
const TZ = 'America/Sao_Paulo';
let ST = null, ASSIN = '', TIMER = null, TICK = null, LENDO = false;

const t = iso => iso ? new Date(iso).getTime() : 0;
const minBR = () => { const p = new Intl.DateTimeFormat('en-GB', {timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(new Date());
  return +p.find(x => x.type === 'hour').value * 60 + +p.find(x => x.type === 'minute').value; };
const hhmm = () => new Intl.DateTimeFormat('pt-BR', {timeZone: TZ, hour: '2-digit', minute: '2-digit'}).format(new Date());
function ha(iso) {
  if (!iso) return '–';
  const s = Math.max(0, Math.round((Date.now() - t(iso)) / 1000));
  if (s < 60) return 'há ' + s + ' s';
  const m = Math.round(s / 60); if (m < 60) return 'há ' + m + ' min';
  const h = Math.floor(m / 60); if (h < 24) return 'há ' + h + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
  return 'há ' + Math.round(h / 24) + ' d';
}
function em(ms) {
  const s = Math.round(ms / 1000);
  if (s <= 0) return 'a qualquer momento';
  if (s < 60) return 'em ' + s + ' s';
  return 'em ' + Math.round(s / 60) + ' min';
}
const horaIni = a => String(Math.floor(a.ini / 60)).padStart(2, '0') + 'h' + (a.ini % 60 ? String(a.ini % 60).padStart(2, '0') : '');

function estado(a, d) {
  const agora = Date.now(), m = minBR(), naJanela = m >= a.ini && m <= a.fim;
  if (!d) return {k: 'off', rot: 'Sem sinal', b: 'Ainda não recebi notícias deste agente'};
  if (agora - t(d.atualizado_em) > 5 * 60e3) return {k: 'atraso', rot: 'Sem atualização', b: 'Sem notícias ' + ha(d.atualizado_em).replace('há', 'há')};
  if (d.falha_leitura) return {k: 'atraso', rot: 'Sem leitura', b: 'Não consegui ler este agente no n8n'};
  if (!d.ativo) return {k: 'off', rot: ROT.off, b: 'Estou desligado no n8n'};
  const recente = d.trabalho && agora - t(d.trabalho.em) < (a.int === 1 ? 3 : 4) * 60e3;
  if (d.rodando || recente) return {k: 'trab', rot: ROT.trab, b: recente ? d.trabalho.texto : 'Trabalhando agora…', s: recente ? ha(d.trabalho.em) : ''};
  if (!naJanela) return {k: 'dorme', rot: ROT.dorme, b: 'Fora do horário. Volto às ' + horaIni(a), s: ''};
  if (d.ultima && d.ultima.status === 'error') return {k: 'erro', rot: ROT.erro, b: 'Deu erro na minha última rodada', s: ha(d.ultima.em)};
  if (!d.ultima || agora - t(d.ultima.em) > (a.int * 2.5 + 1) * 60e3) return {k: 'atraso', rot: ROT.atraso, b: 'Estou atrasado: não rodo ' + (d.ultima ? ha(d.ultima.em) : 'faz tempo'), s: ''};
  return {k: 'plantao', rot: ROT.plantao, b: a.espera, s: d.trabalho ? 'último: ' + d.trabalho.texto.toLowerCase() + ' · ' + ha(d.trabalho.em) : ''};
}

/* ---------------- desenho ---------------- */
function tela(a, k, i) {
  if (k === 'off' || k === 'dorme') return '';
  if (k === 'erro') return `<rect x="140" y="110" width="66" height="50" rx="5" fill="#5a1410"/><text x="173" y="144" text-anchor="middle" font-size="30" font-weight="700" fill="#ff6b5e">!</text>`;
  const op = k === 'trab' ? 1 : .55;
  let c = '';
  if (a.tela === 'chat') for (let j = 0; j < 6; j++) {
    const esq = j % 2 === 0, y = 116 + j * 12;
    c += `<rect x="${esq ? 146 : 168}" y="${y}" width="${esq ? 30 : 32}" height="8" rx="4" fill="${esq ? '#e8ecef' : '#5fd27a'}"/>`;
  }
  if (a.tela === 'grafico') for (let j = 0; j < 2; j++) {
    const o = j * 24;
    c += `<polyline points="146,${148 + o} 156,${138 + o} 166,${143 + o} 176,${128 + o} 186,${134 + o} 200,${120 + o}" fill="none" stroke="#7fb0ff" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<rect x="148" y="${152 + o}" width="5" height="4" fill="#3b6fd8"/><rect x="158" y="${150 + o}" width="5" height="6" fill="#3b6fd8"/><rect x="168" y="${148 + o}" width="5" height="8" fill="#3b6fd8"/>`;
  }
  if (a.tela === 'check') for (let j = 0; j < 6; j++) {
    const y = 118 + j * 12;
    c += `<path d="M147 ${y + 3} l3 3 l5 -6" stroke="#c4b0ff" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="159" y="${y}" width="${36 - (j % 3) * 7}" height="5" rx="2.5" fill="#e3dcff"/>`;
  }
  if (a.tela === 'ideia') for (let j = 0; j < 2; j++) {
    const o = j * 24;
    c += `<circle cx="173" cy="${130 + o}" r="9" fill="#ffd66b"/><rect x="169" y="${139 + o}" width="8" height="4" rx="1" fill="#e0a43a"/>` +
      `<path d="M158 ${126 + o} l-5 -2 M188 ${126 + o} l5 -2 M173 ${116 + o} v-3" stroke="#ffe7a8" stroke-width="2" stroke-linecap="round"/>`;
  }
  return `<g clip-path="url(#tl${i})" opacity="${op}"><g class="linhas">${c}</g></g>`;
}
function robo(a, k, i, cx) {
  const olho = OLHO[k], fechado = k === 'dorme';
  const olhos = fechado
    ? `<path d="M96 115 q5 4 10 0 M114 115 q5 4 10 0" stroke="${olho}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    : `<g class="olhos"><circle cx="101" cy="114" r="5" fill="${olho}"/><circle cx="119" cy="114" r="5" fill="${olho}"/></g>`;
  const boca = k === 'erro' ? `<path d="M104 125 q6 -4 12 0" stroke="${olho}" stroke-width="2" fill="none" stroke-linecap="round"/>`
    : k === 'trab' || k === 'plantao' ? `<path d="M104 123 q6 4 12 0" stroke="${olho}" stroke-width="2" fill="none" stroke-linecap="round"/>` : '';
  const acess = a.id === 'atendente' ? `<path d="M80 112 q0 -30 30 -30 q30 0 30 30" stroke="#24302b" stroke-width="3.5" fill="none"/><rect x="76" y="106" width="8" height="15" rx="4" fill="#24302b"/><rect x="136" y="106" width="8" height="15" rx="4" fill="#24302b"/><path d="M80 120 q4 12 18 12" stroke="#24302b" stroke-width="2.5" fill="none"/><circle cx="99" cy="132" r="2.6" fill="#24302b"/>`
    : a.id === 'monitor' ? `<circle cx="134" cy="96" r="7" fill="none" stroke="#24302b" stroke-width="2.5"/><path d="M139 101 l5 5" stroke="#24302b" stroke-width="3" stroke-linecap="round"/>`
    : a.id === 'validador' ? `<rect x="134" y="152" width="16" height="20" rx="2" fill="#f4f1ff" stroke="#24302b" stroke-width="1.5"/><path d="M138 160 h8 M138 165 h6" stroke="#8b5cf6" stroke-width="1.6"/>`
    : `<path d="M98 92 q-6 -10 4 -12 q2 -8 10 -4 q8 -4 10 4 q10 2 4 12" fill="#ffd66b" stroke="#b57f1d" stroke-width="1.5"/>`;
  return `<g transform="translate(${cx - 110},0)"><g class="robo ${k}">
    <ellipse cx="110" cy="292" rx="96" ry="9" fill="#000" opacity=".07"/>
    <rect x="68" y="128" width="84" height="96" rx="14" fill="#2b3440"/>
    <g class="corpo">
      <g class="cabeca">
        <line x1="110" y1="92" x2="110" y2="78" stroke="#4b5560" stroke-width="3"/>
        <circle class="antena" cx="110" cy="75" r="5" fill="${olho}"/>
        <rect x="82" y="92" width="56" height="46" rx="16" fill="${a.cor}"/>
        <rect x="88" y="100" width="44" height="30" rx="10" fill="#0f1a17"/>
        ${olhos}${boca}
        ${a.id === 'atendente' || a.id === 'cerebro' ? acess : ''}
      </g>
      <rect x="86" y="140" width="48" height="50" rx="13" fill="${a.escuro}"/>
      <circle cx="110" cy="158" r="7" fill="#fff" opacity=".9"/><circle cx="110" cy="158" r="3.5" fill="${a.cor}"/>
      ${a.id === 'monitor' ? acess : ''}
      <rect class="braco-e" x="73" y="148" width="13" height="38" rx="6.5" fill="${a.cor}"/>
      <rect class="braco-d" x="134" y="148" width="13" height="38" rx="6.5" fill="${a.cor}"/>
      ${a.id === 'validador' ? acess : ''}
    </g>
    <text class="z z1" x="140" y="86" font-size="13" font-weight="700" fill="#8a929a">z</text>
    <text class="z z2" x="146" y="80" font-size="15" font-weight="700" fill="#8a929a">z</text>
    <text class="z z3" x="152" y="74" font-size="17" font-weight="700" fill="#8a929a">Z</text>
    <rect x="10" y="188" width="200" height="12" rx="3" fill="#caa47c"/>
    <rect x="20" y="200" width="180" height="78" rx="3" fill="#b38b63"/>
    <rect x="30" y="212" width="160" height="2" fill="#a07a54"/>
    <rect x="22" y="278" width="10" height="12" fill="#8f6c49"/><rect x="188" y="278" width="10" height="12" fill="#8f6c49"/>
    <rect x="84" y="182" width="50" height="7" rx="2" fill="#e8ecef"/>
    <rect x="166" y="160" width="7" height="28" fill="#4b5560"/><rect x="156" y="184" width="27" height="5" rx="2" fill="#4b5560"/>
    <rect x="137" y="107" width="72" height="56" rx="6" fill="#0b1015"/>
    <rect x="140" y="110" width="66" height="50" rx="5" fill="#1d2630"/>
    ${tela(a, k, i)}
    <rect x="34" y="170" width="16" height="18" rx="3" fill="#fff" stroke="#c9d1cc"/><path d="M50 175 q7 0 7 6 q0 6 -7 6" fill="none" stroke="#c9d1cc" stroke-width="2"/>
    ${k === 'trab' ? '<path class="vapor" d="M39 166 q-3 -5 0 -9" stroke="#b9c2bd" stroke-width="2" fill="none" stroke-linecap="round"/><path class="vapor vapor2" d="M45 166 q3 -5 0 -9" stroke="#b9c2bd" stroke-width="2" fill="none" stroke-linecap="round"/>' : ''}
  </g></g>`;
}
function cena(estados) {
  const m = minBR(), dia = m >= 6 * 60 && m < 18 * 60, todosDormem = estados.every(e => e.k === 'dorme' || e.k === 'off');
  const ceu = dia ? '<rect x="432" y="32" width="136" height="86" fill="#bfe3ff"/><circle cx="540" cy="58" r="11" fill="#ffe28a"/><path d="M445 104 q20 -18 40 0 q18 -14 36 0 q20 -16 40 0 v14 h-116z" fill="#9fd29a"/>'
    : '<rect x="432" y="32" width="136" height="86" fill="#1c2b4a"/><circle cx="540" cy="58" r="10" fill="#f3f0d8"/><circle cx="545" cy="54" r="9" fill="#1c2b4a"/><circle cx="460" cy="50" r="1.4" fill="#fff"/><circle cx="485" cy="70" r="1.2" fill="#fff"/><circle cx="510" cy="45" r="1.5" fill="#fff"/><circle cx="470" cy="92" r="1.1" fill="#fff"/>';
  // clipPath em coordenadas locais do robô (o grupo é transladado)
  const clipsLocais = AG.map((a, i) => `<clipPath id="tl${i}"><rect x="140" y="110" width="66" height="50" rx="5"/></clipPath>`).join('');
  return `<svg viewBox="0 -22 1000 322" role="img" aria-label="Escritório dos agentes">
    <defs>${clipsLocais}</defs>
    <rect y="-22" width="1000" height="237" fill="#eef3f0"/>
    <rect y="207" width="1000" height="8" fill="#d6dfd9"/>
    <rect y="215" width="1000" height="85" fill="#e2e8e3"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(j => `<line x1="${j * 125}" y1="215" x2="${j * 125 - 30}" y2="300" stroke="#d4dcd6" stroke-width="1.5"/>`).join('')}
    <rect x="426" y="26" width="148" height="98" rx="4" fill="#fff" stroke="#cfd8d2" stroke-width="2"/>${ceu}
    <line x1="500" y1="32" x2="500" y2="118" stroke="#fff" stroke-width="4"/><line x1="432" y1="75" x2="568" y2="75" stroke="#fff" stroke-width="4"/>
    <circle cx="250" cy="62" r="30" fill="#fff" stroke="#cfd8d2" stroke-width="3"/>
    <text id="esc-relogio" x="250" y="68" text-anchor="middle" font-size="16" font-weight="600" fill="#1c1c1c">${hhmm()}</text>
    <text x="250" y="108" text-anchor="middle" font-size="10" fill="#8a929a">Brasília</text>
    <rect x="736" y="28" width="76" height="92" rx="6" fill="#00503c"/>
    <image href="assets/coruja-branca.png" x="750" y="38" width="48" height="48"/>
    <text x="774" y="104" text-anchor="middle" font-size="9.5" font-weight="600" fill="#fff">MEU</text>
    <text x="774" y="115" text-anchor="middle" font-size="9.5" font-weight="600" fill="#fff">PATRIMÔNIO</text>
    <g transform="translate(985,0)"><rect x="-8" y="176" width="20" height="30" rx="3" fill="#c9805a"/><path d="M2 176 q-14 -20 -6 -40 q6 14 6 40 q2 -26 12 -38 q4 22 -12 38" fill="#4f9d5d"/></g>
    <g transform="translate(15,0)"><rect x="-8" y="176" width="20" height="30" rx="3" fill="#c9805a"/><path d="M2 176 q-14 -20 -6 -40 q6 14 6 40 q2 -26 12 -38 q4 22 -12 38" fill="#4f9d5d"/></g>
    ${AG.map((a, i) => robo(a, estados[i].k, i, i * 250 + 125)).join('')}
    ${todosDormem && !dia ? '<rect y="-22" width="1000" height="322" fill="#0b1630" opacity=".28"/>' : ''}
  </svg>`;
}

/* ---------------- tela HTML ---------------- */
function montar() {
  const box = document.getElementById('escritorio'); if (!box) return;
  const ags = (ST && ST.agentes) || [];
  const est = AG.map(a => estado(a, ags.find(x => x.id === a.id)));
  const assin = est.map(e => e.k).join('|') + (minBR() >= 360 && minBR() < 1080 ? 'd' : 'n');
  if (!box.querySelector('.esc-card') || assin !== ASSIN) {
    ASSIN = assin;
    box.innerHTML = `<div class="esc-card">
      <div class="esc-top"><div><h2>Escritório dos agentes</h2><p>Quem está trabalhando agora, ao vivo. Atualiza sozinho a cada 30 segundos.</p></div>
        <div class="esc-resumo" id="esc-resumo"></div></div>
      <div class="esc-wrap"><div class="esc-cena" id="esc-cena">${cena(est)}</div></div>
      <div class="esc-cards" id="esc-cards"></div></div>`;
  }
  // bolhas e cartões (texto muda a cada segundo, sem refazer o desenho)
  const cenaEl = document.getElementById('esc-cena');
  cenaEl.querySelectorAll('.bolha').forEach(b => b.remove());
  est.forEach((e, i) => {
    const b = document.createElement('div');
    b.className = 'bolha ' + e.k; b.style.left = ((i * 250 + 125) / 10) + '%'; b.style.bottom = (100 - (64 + 22) / 322 * 100) + '%';
    b.innerHTML = ESC(e.b) + (e.s ? `<small>${ESC(e.s)}</small>` : '');
    cenaEl.appendChild(b);
  });
  const rel = document.getElementById('esc-relogio'); if (rel) rel.textContent = hhmm();
  const n = k => est.filter(e => e.k === k).length;
  document.getElementById('esc-resumo').innerHTML =
    `<span><b>${n('trab')}</b> trabalhando</span><span><b>${n('plantao')}</b> de plantão</span>` +
    (n('dorme') ? `<span><b>${n('dorme')}</b> dormindo</span>` : '') +
    (n('erro') + n('atraso') + n('off') ? `<span style="background:#fdecea;color:#b42318"><b>${n('erro') + n('atraso') + n('off')}</b> precisando de atenção</span>` : '');
  document.getElementById('esc-cards').innerHTML = AG.map((a, i) => {
    const d = ags.find(x => x.id === a.id) || {}, e = est[i], m = minBR(), naJ = m >= a.ini && m <= a.fim;
    const prox = !d.ativo ? '–' : !naJ ? 'amanhã às ' + horaIni(a) : d.ultima ? em(t(d.ultima.em) + a.int * 60e3 - Date.now()) : '–';
    const st = d.ultima ? (d.ultima.status === 'error' ? ' · <b style="color:#b42318">erro</b>' : d.ultima.status === 'success' ? ' · ok' : ' · ' + ESC(d.ultima.status)) : '';
    return `<div class="ag"><div class="ag-h"><i style="background:${a.cor}"></i><b>${a.nome}</b></div>
      <div class="ag-f">${ESC(a.funcao)}</div>
      <span class="pill p-${e.k}">${ESC(e.rot)}</span>
      <div class="ag-l"><span>Última rodada:</span> ${d.ultima ? ha(d.ultima.em) + st : '–'}<br>
      <span>Próxima:</span> ${prox}<br>
      <span>Último trabalho:</span> ${d.trabalho ? ESC(d.trabalho.texto) + ' · ' + ha(d.trabalho.em) : 'nada na última hora'}<br>
      <span>Erros em 24 h:</span> ${d.erros_24h == null ? '–' : d.erros_24h ? `<b style="color:#b42318">${d.erros_24h}</b>` : '0'}</div></div>`;
  }).join('');
}
async function ler() {
  if (LENDO) return; LENDO = true;
  try {
    let x = lerSessao(); if (!x) return;
    if (Date.now() > x.x - 60000) { x = await renova(x); if (!x) return; }
    let r = await sb('/rest/v1/rpc/agentes_status', {body: {}, token: x.a});
    if (r.status === 401) { x = await renova(x); if (!x) return; r = await sb('/rest/v1/rpc/agentes_status', {body: {}, token: x.a}); }
    if (r.ok && r.j) ST = r.j;
  } finally { LENDO = false; montar(); }
}
window.Escritorio = {
  iniciar() {
    montar(); ler();
    clearInterval(TIMER); clearInterval(TICK);
    TIMER = setInterval(() => { if (!document.hidden) ler(); }, 30000);
    TICK = setInterval(() => { if (!document.hidden) montar(); }, 1000);
  },
  _dados(d) { ST = d; montar(); },   // usado no teste local
};
// o painel pode ter aberto antes deste arquivo carregar
const app = document.getElementById('app');
if (app && !app.classList.contains('hidden') && lerSessao()) window.Escritorio.iniciar();
})();
