/* Escritório dos agentes: cena 2D com a situação de cada agente (lida do Supabase a cada 30 s). */
(function () {
'use strict';
const AG = [
  {id: 'cerebro', nome: 'Cérebro', funcao: 'Central: guarda o que a empresa sabe e o que a Patrícia aprendeu nas conversas, e alimenta os outros agentes.',
   cor: '#2fd4c4', escuro: '#0f8f86', int: 15, ini: 8 * 60, fim: 21 * 60 + 30, tela: 'ideia', espera: 'Esperando conversas novas'},
  {id: 'patricia', nome: 'Patrícia', fontes: ['atendente', 'mppro', 'verificador'],
   funcao: 'Conversa com os leads no WhatsApp, atende quem pergunta do MP PRO e revisa as conversas paradas.',
   cor: '#16a34a', escuro: '#0f7a35', int: 1, ini: 8 * 60, fim: 20 * 60 - 1, tela: 'chat', espera: 'Esperando mensagem de lead'},
  {id: 'monitor', nome: 'Monitor', funcao: 'Vigia a Patrícia a cada 10 minutos e avisa a equipe se algo der errado.',
   cor: '#3b6fd8', escuro: '#2a52a6', int: 10, ini: 8 * 60, fim: 20 * 60 + 40, tela: 'grafico', espera: 'De olho na Patrícia'},
  {id: 'validador', nome: 'Validador', funcao: 'Confere a cada 30 minutos se o Monitor está fazendo o trabalho direito.',
   cor: '#8b5cf6', escuro: '#6a3fd0', int: 30, ini: 8 * 60 + 10, fim: 21 * 60, tela: 'check', espera: 'De olho no Monitor'},
];

/* A Patrícia é um robô só no desenho, mas são três fluxos no n8n (Atendente, MP PRO e Verificador).
   Consolida os três num estado único: basta um falhar para ela acender alerta. */
function dadosDe(a, ags) {
  if (!a.fontes) return ags.find(x => x.id === a.id);
  const ds = a.fontes.map(id => ags.find(x => x.id === id)).filter(Boolean);
  if (!ds.length) return null;
  const recente = k => ds.map(d => d[k]).filter(Boolean).sort((p, q) => t(q.em) - t(p.em))[0] || null;
  const comErro = ds.find(d => d.ultima && d.ultima.status === 'error');
  return {
    ativo: ds.some(d => d.ativo),
    rodando: ds.some(d => d.rodando),
    atualizado_em: ds.map(d => d.atualizado_em).filter(Boolean).sort().slice(-1)[0],
    falha_leitura: ds.some(d => d.falha_leitura),
    ultima: comErro ? comErro.ultima : recente('ultima'),
    trabalho: recente('trabalho'),
    erros_24h: ds.reduce((s, d) => s + (d.erros_24h || 0), 0),
    _fontes: ds.length
  };
}
const ROT = {trab: 'Trabalhando', plantao: 'De plantão', dorme: 'Dormindo', erro: 'Com erro', atraso: 'Atrasado', off: 'Desligado'};

/* Cartões "Quem cuida da Patrícia": só os agentes de apoio, com a última rodada de cada um. */
const QC_IC = {
  monitor: '<path d="M3 17l5-6 4 4 5-8 4 5"/>',
  validador: '<path d="M20 6L9 17l-5-5"/>',
  cerebro: '<path d="M12 3a6 6 0 0 0-3 11v3h6v-3a6 6 0 0 0-3-11z"/><path d="M10 21h4"/>',
  verificador: '<path d="M4 6h16M4 12h16M4 18h10"/>'
};
const QC_ORDEM = ['monitor', 'validador', 'cerebro'];
function quemCuida(ags, est) {
  const box = document.getElementById('quem-cuida'); if (!box) return;
  box.innerHTML = QC_ORDEM.map(id => {
    const i = AG.findIndex(a => a.id === id); if (i < 0) return '';
    const a = AG[i], d = dadosDe(a, ags) || {}, e = est[i] || {};
    const ruim = e.k === 'erro' || e.k === 'atraso' || e.k === 'off';
    const cls = ruim ? (e.k === 'erro' ? 'qc-e' : 'qc-w') : 'qc-ok';
    const quando = d.ultima ? 'rodou ' + ha(d.ultima.em) : (ROT[e.k] || '—');
    return `<div class="qc-c"><div class="qc-i" style="background:${a.cor}"><svg viewBox="0 0 24 24">${QC_IC[id]}</svg></div>
      <div><h4>${ESC(a.nome)}</h4><p>${ESC(a.funcao)}</p>
      <span class="qc-s ${cls}"><i></i>${ESC(quando)}</span></div></div>`;
  }).join('');
}
const OLHO = {trab: '#7CFFB2', plantao: '#9fd8ff', erro: '#ff6b5e', atraso: '#ffc861', off: '#8a929a', dorme: '#8a929a'};
const TZ = 'America/Sao_Paulo';
const W = 860, Y0 = -78, H = 698, ANDAR = 320;           // cena com dois andares
const NB = AG.length - 1;   // agentes do andar de baixo
const CX = W / 2;           // eixo central (orbe do Cérebro)
const POS = AG.map((a, i) => i === 0 ? {x: CX, y: 0} : {x: (i - 1) * (W / NB) + W / NB / 2, y: ANDAR});
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
  if (a.tela === 'lista') for (let j = 0; j < 6; j++) {
    const y = 117 + j * 12, cor = ['#ff8a7a', '#ffd166', '#7ce0c3'][j % 3];
    c += `<circle cx="150" cy="${y + 3}" r="3" fill="${cor}"/><rect x="157" y="${y}" width="${40 - (j % 2) * 10}" height="6" rx="3" fill="#cdeeed"/>`;
  }
  if (a.tela === 'pro') for (let j = 0; j < 6; j++) {
    const esq = j % 2 === 0, y = 116 + j * 12;
    c += `<rect x="${esq ? 146 : 166}" y="${y}" width="${esq ? 30 : 34}" height="8" rx="4" fill="${esq ? '#e8ecef' : '#e4d6a7'}"/>`;
  }
  if (a.tela === 'ideia') for (let j = 0; j < 2; j++) {
    const o = j * 24;
    c += `<circle cx="173" cy="${130 + o}" r="9" fill="#ffd66b"/><rect x="169" y="${139 + o}" width="8" height="4" rx="1" fill="#e0a43a"/>` +
      `<path d="M158 ${126 + o} l-5 -2 M188 ${126 + o} l5 -2 M173 ${116 + o} v-3" stroke="#ffe7a8" stroke-width="2" stroke-linecap="round"/>`;
  }
  return `<g clip-path="url(#tl${i})" opacity="${op}"><g class="linhas">${c}</g></g>`;
}
function robo(a, k, i, cx, oy) {
  const olho = OLHO[k], fechado = k === 'dorme';
  const olhos = fechado
    ? `<path d="M96 115 q5 4 10 0 M114 115 q5 4 10 0" stroke="${olho}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    : `<g class="olhos"><circle cx="101" cy="114" r="5" fill="${olho}"/><circle cx="119" cy="114" r="5" fill="${olho}"/></g>`;
  const boca = k === 'erro' ? `<path d="M104 125 q6 -4 12 0" stroke="${olho}" stroke-width="2" fill="none" stroke-linecap="round"/>`
    : k === 'trab' || k === 'plantao' ? `<path d="M104 123 q6 4 12 0" stroke="${olho}" stroke-width="2" fill="none" stroke-linecap="round"/>` : '';
  const acess = a.id === 'patricia' ? `<path d="M76 128 q-2 -46 34 -46 q36 0 34 46 q-7 3 -9 -4 q1 -28 -25 -28 q-26 0 -25 28 q-2 7 -9 4z" fill="#c4622d"/><path d="M85 101 q9 -15 25 -15 q16 0 25 15 q-13 -7 -25 -5 q-12 -2 -25 5z" fill="#b2561f"/><path d="M80 112 q0 -30 30 -30 q30 0 30 30" stroke="#24302b" stroke-width="3.5" fill="none"/><rect x="76" y="106" width="8" height="15" rx="4" fill="#24302b"/><rect x="136" y="106" width="8" height="15" rx="4" fill="#24302b"/><path d="M80 120 q4 12 18 12" stroke="#24302b" stroke-width="2.5" fill="none"/><circle cx="99" cy="132" r="2.6" fill="#24302b"/>`
    : a.id === 'monitor' ? `<circle cx="134" cy="96" r="7" fill="none" stroke="#24302b" stroke-width="2.5"/><path d="M139 101 l5 5" stroke="#24302b" stroke-width="3" stroke-linecap="round"/>`
    : a.id === 'validador' ? `<rect x="134" y="152" width="16" height="20" rx="2" fill="#f4f1ff" stroke="#24302b" stroke-width="1.5"/><path d="M138 160 h8 M138 165 h6" stroke="#8b5cf6" stroke-width="1.6"/>`
    : a.id === 'verificador' ? `<circle cx="101" cy="114" r="8" fill="none" stroke="#e8ecef" stroke-width="2.2"/><circle cx="119" cy="114" r="8" fill="none" stroke="#e8ecef" stroke-width="2.2"/><path d="M109 114 h2" stroke="#e8ecef" stroke-width="2.2"/>`
    : `<path d="M98 92 q-6 -10 4 -12 q2 -8 10 -4 q8 -4 10 4 q10 2 4 12" fill="#ffd66b" stroke="#b57f1d" stroke-width="1.5"/>`;
  return `<g transform="translate(${cx - 110},${oy || 0})"><g class="robo ${k}">
    <ellipse cx="110" cy="292" rx="96" ry="9" fill="#000" opacity=".07"/>
    <rect x="68" y="128" width="84" height="96" rx="14" fill="#2b3440"/>
    <g class="corpo">
      <g class="cabeca">
        <line x1="110" y1="92" x2="110" y2="78" stroke="#4b5560" stroke-width="3"/>
        <circle class="antena" cx="110" cy="75" r="5" fill="${olho}"/>
        <rect x="82" y="92" width="56" height="46" rx="16" fill="${a.cor}"/>
        <rect x="88" y="100" width="44" height="30" rx="10" fill="#0f1a17"/>
        ${olhos}${boca}
        ${a.id === 'patricia' ? acess : ''}
      </g>
      <rect x="86" y="140" width="48" height="50" rx="13" fill="${a.escuro}"/>
      ${a.id === 'mppro' ? '<rect x="94" y="151" width="32" height="14" rx="7" fill="#12100c"/><text x="110" y="161.5" text-anchor="middle" font-size="8.5" font-weight="700" letter-spacing=".06em" fill="#e4d6a7">PRO</text>'
        : `<circle cx="110" cy="158" r="7" fill="#fff" opacity=".9"/><circle cx="110" cy="158" r="3.5" fill="${a.cor}"/>`}
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
/* O Cérebro não é um robô: é uma esfera de energia girando sobre um pedestal. */
function cascaD(raio, ondas, amp, fase) {   // centrada em (0,0): o grupo de fora posiciona
  const N = 64; let d = '';
  for (let i = 0; i <= N; i++) {
    const ang = (i / N) * Math.PI * 2, r = raio + Math.sin(ang * ondas + fase) * amp;
    d += (i ? 'L' : 'M') + (Math.cos(ang) * r).toFixed(1) + ' ' + (Math.sin(ang) * r * .92).toFixed(1);
  }
  return d + 'Z';
}
function orbe(a, k, cx) {
  const CY = 136, R = 84, parado = k === 'off' || k === 'dorme';
  const vel = k === 'trab' ? 1 : k === 'erro' ? .8 : parado ? 0 : .5;
  const dur = s => (s / (vel || .001)).toFixed(1) + 's';
  const cor = k === 'erro' ? '#ff8a7a' : k === 'atraso' ? '#ffc861' : parado ? '#7f9b97' : '#4fe3d2';
  const claro = k === 'erro' ? '#ffd9d3' : k === 'atraso' ? '#ffe3b0' : parado ? '#cfdedc' : '#bffff5';
  const op = parado ? .45 : 1;
  // a membrana gira devagar no próprio eixo, como na referência
  // núcleo: esfera de pontos
  let nuc = '';
  for (let r = 0; r <= 4; r++) {
    const n = r === 0 ? 1 : r * 6, rad = r * 7;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + r * .4;
      nuc += `<circle cx="${(110 + Math.cos(ang) * rad).toFixed(1)}" cy="${(CY + Math.sin(ang) * rad * .82).toFixed(1)}" r="${r === 0 ? 2.6 : 1.7}" fill="${claro}" opacity="${(1 - r * .13).toFixed(2)}"/>`;
    }
  }
  // faíscas subindo dentro da esfera
  let faisca = '';
  if (vel) for (let i = 0; i < 4; i++) {
    const x = 110 + [-38, -14, 16, 40][i], d = (3.2 + i * .7) / (vel || 1);
    faisca += `<circle cx="${x}" cy="${CY + 40}" r="${1.6 + (i % 2) * .6}" fill="${claro}" opacity="0">
      <animate attributeName="cy" from="${CY + 44}" to="${CY - 44}" dur="${d.toFixed(1)}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;.85;.85;0" dur="${d.toFixed(1)}s" repeatCount="indefinite"/></circle>`;
  }
  return `<g transform="translate(${cx - 110},0)"><g class="orbe ${k}">
    <ellipse cx="110" cy="292" rx="74" ry="8" fill="#000" opacity=".08"/>
    <ellipse cx="110" cy="${CY}" rx="${R + 48}" ry="${R + 44}" fill="url(#orbHalo)" opacity="${parado ? .3 : .95}"/>
    <g opacity="${op}">
      <ellipse cx="110" cy="${CY}" rx="${R - 8}" ry="${R - 10}" fill="url(#orbCorpo)"/>
      <g transform="translate(110,${CY})">
        <path class="memb m1" d="${cascaD(R - 5, 8, 4, 0)}" fill="${cor}" fill-opacity=".10" stroke="${cor}" stroke-width="2" opacity=".6"/>
        <path class="memb m2" d="${cascaD(R - 14, 6, 5, 1.7)}" fill="${claro}" fill-opacity=".07" stroke="${claro}" stroke-width="1.4" opacity=".36"/>
      </g>
      <ellipse cx="${110 - R * .3}" cy="${CY - R * .34}" rx="${R * .3}" ry="${R * .22}" fill="#eafffb" opacity=".12" transform="rotate(-28 ${110 - R * .3} ${CY - R * .34})"/>
      ${faisca}
      <circle class="nucleo" cx="110" cy="${CY}" r="34" fill="url(#orbNucleo)"/>
      <g class="gnuc">${nuc}</g>
      <circle cx="110" cy="${CY}" r="${R - 8}" fill="none" stroke="${cor}" stroke-width="1.2" opacity=".3"/>
    </g>
    <path d="M94 ${CY + R - 16} q16 14 32 0 v38 h-32z" fill="#223a40" opacity=".9"/>
    <rect x="86" y="236" width="48" height="34" rx="5" fill="#2a3b42"/>
    <rect x="66" y="266" width="88" height="13" rx="4" fill="#1f2d33"/>
    <rect x="58" y="240" width="104" height="26" rx="4" fill="${parado ? '#4a5d62' : '#0f8f86'}"/>
    <text x="110" y="257" text-anchor="middle" font-size="11" font-weight="700" letter-spacing=".08em" fill="#fff">CÉREBRO</text>
  </g></g>`;
}
function cena(estados) {
  const m = minBR(), dia = m >= 6 * 60 && m < 18 * 60, todosDormem = estados.every(e => e.k === 'dorme' || e.k === 'off');
  const ceu = dia ? '<rect x="232" y="32" width="136" height="86" fill="#bfe3ff"/><circle cx="340" cy="58" r="11" fill="#ffe28a"/><path d="M245 104 q20 -18 40 0 q18 -14 36 0 q20 -16 40 0 v14 h-116z" fill="#9fd29a"/>'
    : '<rect x="232" y="32" width="136" height="86" fill="#1c2b4a"/><circle cx="340" cy="58" r="10" fill="#f3f0d8"/><circle cx="345" cy="54" r="9" fill="#1c2b4a"/><circle cx="260" cy="50" r="1.4" fill="#fff"/><circle cx="285" cy="70" r="1.2" fill="#fff"/><circle cx="310" cy="45" r="1.5" fill="#fff"/><circle cx="270" cy="92" r="1.1" fill="#fff"/>';
  const clipsLocais = AG.map((a, i) => `<clipPath id="tl${i}"><rect x="140" y="110" width="66" height="50" rx="5"/></clipPath>`).join('');
  const planta = (x, y) => `<g transform="translate(${x},${y})"><rect x="-8" y="176" width="20" height="30" rx="3" fill="#c9805a"/><path d="M2 176 q-14 -20 -6 -40 q6 14 6 40 q2 -26 12 -38 q4 22 -12 38" fill="#4f9d5d"/></g>`;
  // ligações: tudo sai do Cérebro e chega em cada agente do andar de baixo
  const cerebroTrab = estados[0].k === 'trab';
  const fios = AG.slice(1).map((a, n) => {
    const p = POS[n + 1], x0 = CX + (n - (NB - 1) / 2) * 30;
    return `<path d="M${x0} 296 C ${x0} 330, ${p.x} 318, ${p.x} ${ANDAR + 62}" fill="none" stroke="${a.cor}" stroke-width="3" opacity=".55" stroke-linecap="round"/>` +
      `<path class="fluxo${cerebroTrab ? ' rapido' : ''}" d="M${x0} 296 C ${x0} 330, ${p.x} 318, ${p.x} ${ANDAR + 62}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="4 14" stroke-linecap="round" opacity=".9"/>` +
      `<circle cx="${p.x}" cy="${ANDAR + 62}" r="5" fill="${a.cor}"/>`;
  }).join('');
  const piso = ANDAR + 207;
  return `<svg viewBox="0 ${Y0} ${W} ${H}" role="img" aria-label="Escritório dos agentes: o Cérebro no andar de cima, ligado aos outros agentes">
    <defs>${clipsLocais}
      <radialGradient id="halo"><stop offset="0" stop-color="#9ff3e8" stop-opacity=".55"/><stop offset="1" stop-color="#9ff3e8" stop-opacity="0"/></radialGradient>
      <radialGradient id="orbHalo"><stop offset="0" stop-color="#4fe3d2" stop-opacity=".5"/><stop offset=".55" stop-color="#2fd4c4" stop-opacity=".16"/><stop offset="1" stop-color="#2fd4c4" stop-opacity="0"/></radialGradient>
      <radialGradient id="orbCorpo" cx=".38" cy=".32"><stop offset="0" stop-color="#1d6f73" stop-opacity=".82"/><stop offset=".62" stop-color="#0d4a52" stop-opacity=".72"/><stop offset="1" stop-color="#07323a" stop-opacity=".88"/></radialGradient>
      <radialGradient id="orbNucleo"><stop offset="0" stop-color="#eafffb"/><stop offset=".45" stop-color="#5fe8d8" stop-opacity=".55"/><stop offset="1" stop-color="#2fd4c4" stop-opacity="0"/></radialGradient></defs>
    <!-- andar de cima: sala do Cérebro -->
    <rect y="${Y0}" width="${W}" height="${207 - Y0}" fill="#f5f2e8"/>
    <rect y="207" width="${W}" height="8" fill="#e2dccb"/>
    <rect y="215" width="${W}" height="${ANDAR - 215}" fill="#ebe5d4"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(j => `<line x1="${j * 125}" y1="215" x2="${j * 125 - 30}" y2="${ANDAR}" stroke="#e0d9c6" stroke-width="1.5"/>`).join('')}
    <ellipse cx="${CX}" cy="150" rx="210" ry="130" fill="url(#halo)"/>
    <rect x="226" y="26" width="148" height="98" rx="4" fill="#fff" stroke="#d8d0bb" stroke-width="2"/>${ceu}
    <line x1="300" y1="32" x2="300" y2="118" stroke="#fff" stroke-width="4"/><line x1="232" y1="75" x2="368" y2="75" stroke="#fff" stroke-width="4"/>
    <circle cx="110" cy="62" r="30" fill="#fff" stroke="#d8d0bb" stroke-width="3"/>
    <text id="esc-relogio" x="110" y="68" text-anchor="middle" font-size="16" font-weight="600" fill="#1c1c1c">${hhmm()}</text>
    <text x="110" y="108" text-anchor="middle" font-size="10" fill="#8a929a">Brasília</text>
    <rect x="712" y="28" width="76" height="92" rx="6" fill="#00503c"/>
    <image href="assets/coruja-branca.png" x="726" y="38" width="48" height="48"/>
    <text x="750" y="104" text-anchor="middle" font-size="9.5" font-weight="600" fill="#fff">MEU</text>
    <text x="750" y="115" text-anchor="middle" font-size="9.5" font-weight="600" fill="#fff">PATRIMÔNIO</text>
    ${planta(830, 0)}${planta(150, 0)}
    <!-- piso do mezanino -->
    <rect y="${ANDAR - 8}" width="${W}" height="14" fill="#cfc6b0"/>
    <rect y="${ANDAR + 6}" width="${W}" height="4" fill="#b9af97" opacity=".6"/>
    <!-- andar de baixo: agentes -->
    <rect y="${ANDAR + 10}" width="${W}" height="${piso - ANDAR - 10}" fill="#eef3f0"/>
    <rect y="${piso}" width="${W}" height="8" fill="#d6dfd9"/>
    <rect y="${piso + 8}" width="${W}" height="${Y0 + H - piso - 8}" fill="#e2e8e3"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(j => `<line x1="${j * 125}" y1="${piso + 8}" x2="${j * 125 - 30}" y2="${Y0 + H}" stroke="#d4dcd6" stroke-width="1.5"/>`).join('')}
    ${planta(15, ANDAR)}${planta(845, ANDAR)}
    ${fios}
    ${AG.map((a, i) => i === 0 ? orbe(a, estados[i].k, POS[i].x)
                                : robo(a, estados[i].k, i, POS[i].x, POS[i].y)).join('')}
    ${todosDormem && !dia ? `<rect y="${Y0}" width="${W}" height="${H}" fill="#0b1630" opacity=".28"/>` : ''}
  </svg>`;
}

/* ---------------- tela HTML ---------------- */
function montar() {
  const box = document.getElementById('escritorio'); if (!box) return;
  const ags = (ST && ST.agentes) || [];
  const est = AG.map(a => estado(a, dadosDe(a, ags)));
  const assin = est.map(e => e.k).join('|') + (minBR() >= 360 && minBR() < 1080 ? 'd' : 'n');
  if (!box.querySelector('.esc-card') || assin !== ASSIN) {
    ASSIN = assin;
    box.innerHTML = `<div class="esc-card">
      <div class="esc-top"><div><h2>Escritório dos agentes</h2><p>O Cérebro fica no andar de cima e alimenta todo mundo. Embaixo, a Patrícia atende e os dois agentes de apoio conferem o trabalho dela. Atualiza sozinho a cada 30 segundos.</p></div>
        <div class="esc-resumo" id="esc-resumo"></div></div>
      <div class="esc-wrap"><div class="esc-cena" id="esc-cena">${cena(est)}</div></div>
      <div class="esc-cards" id="esc-cards"></div></div>`;
  }
  // bolhas e cartões (texto muda a cada segundo, sem refazer o desenho)
  const cenaEl = document.getElementById('esc-cena');
  cenaEl.querySelectorAll('.bolha').forEach(b => b.remove());
  est.forEach((e, i) => {
    const b = document.createElement('div');
    b.className = 'bolha ' + e.k + (i === 0 ? ' cerebro' : ''); b.style.left = (POS[i].x / W * 100) + '%';
    b.style.bottom = (100 - (POS[i].y + (i === 0 ? -20 : 64) - Y0) / H * 100) + '%';
    b.innerHTML = ESC(e.b) + (e.s ? `<small>${ESC(e.s)}</small>` : '');
    cenaEl.appendChild(b);
  });
  const rel = document.getElementById('esc-relogio'); if (rel) rel.textContent = hhmm();
  quemCuida(ags, est);
  const n = k => est.filter(e => e.k === k).length;
  document.getElementById('esc-resumo').innerHTML =
    `<span><b>${n('trab')}</b> trabalhando</span><span><b>${n('plantao')}</b> de plantão</span>` +
    (n('dorme') ? `<span><b>${n('dorme')}</b> dormindo</span>` : '') +
    (n('erro') + n('atraso') + n('off') ? `<span style="background:#fdecea;color:#b42318"><b>${n('erro') + n('atraso') + n('off')}</b> precisando de atenção</span>` : '');
  document.getElementById('esc-cards').innerHTML = AG.map((a, i) => {
    const d = dadosDe(a, ags) || {}, e = est[i], m = minBR(), naJ = m >= a.ini && m <= a.fim;
    const prox = !d.ativo ? '–' : !naJ ? 'amanhã às ' + horaIni(a) : d.ultima ? em(t(d.ultima.em) + a.int * 60e3 - Date.now()) : '–';
    const st = d.ultima ? (d.ultima.status === 'error' ? ' · <b style="color:#b42318">erro</b>' : d.ultima.status === 'success' ? ' · ok' : ' · ' + ESC(d.ultima.status)) : '';
    return `<div class="ag${i === 0 ? ' cerebro' : ''}"><div class="ag-h"><i style="background:${a.cor}"></i><b>${a.nome}</b></div>
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
