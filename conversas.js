/* Leads atendidos pelo bot: lista (nome + WhatsApp) e prévia das mensagens de cada conversa.
   Os dados vêm ao vivo do Pipedrive pela API do painel no n8n (exige o login @meupatrimonio.com). */
(function () {
'use strict';
const API = 'https://n8n.meupatrimonio.com/webhook/painel-conversas';
const TZ = 'America/Sao_Paulo';
let LISTA = null, ERRO = '', LENDO = false;
const RES = {requalificado: ['Requalificado', 'var(--c-req)'], desqualificado: ['Fora do perfil', 'var(--c-fora)'],
  sem_interesse: ['Sem interesse', 'var(--c-sem)'], humano: ['Equipe assumiu', 'var(--c-eq)'], conversando: ['Em andamento', '#7cc58a']};
const TIPO = {audio: 'áudio', image: 'imagem', video: 'vídeo', document: 'documento', sticker: 'figurinha', location: 'localização', contacts: 'contato'};

function fone(n) {
  n = String(n || '').replace(/\D/g, '');
  if (n.startsWith('55') && n.length >= 12) {
    const dd = n.slice(2, 4), r = n.slice(4);
    return '(' + dd + ') ' + (r.length === 9 ? r.slice(0, 5) + '-' + r.slice(5) : r.slice(0, 4) + '-' + r.slice(4));
  }
  return n ? '+' + n : '–';
}
const dataHora = iso => new Intl.DateTimeFormat('pt-BR', {timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}).format(new Date(iso)).replace(',', '');
const hora = iso => new Intl.DateTimeFormat('pt-BR', {timeZone: TZ, hour: '2-digit', minute: '2-digit'}).format(new Date(iso));
const dia = iso => new Intl.DateTimeFormat('pt-BR', {timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long'}).format(new Date(iso));
function ha(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min';
  const h = Math.round(m / 60); if (h < 24) return 'há ' + h + ' h';
  return 'há ' + Math.round(h / 24) + ' d';
}
const primeiroNome = s => String(s || '').trim().split(/\s+/)[0] || '';

async function chamar(corpo) {
  let x = lerSessao(); if (!x) return {erro: 'sem login'};
  if (Date.now() > x.x - 60000) { x = await renova(x); if (!x) return {erro: 'sem login'}; }
  try {
    const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + x.a}, body: JSON.stringify(corpo)});
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) return {erro: 'Seu login expirou. Saia e entre de novo.'};
    if (!r.ok) return {erro: j.erro || 'Não consegui buscar agora.'};
    return j;
  } catch (e) { return {erro: 'Sem conexão com o servidor das conversas.'}; }
}
async function carregarLista() {
  if (LENDO) return; LENDO = true;
  const j = await chamar({acao: 'lista'});
  LENDO = false;
  if (j.erro) ERRO = j.erro; else { LISTA = j.conversas || []; ERRO = ''; }
  desenhar();
}

function linhas() {
  // mesmas regras de filtro da tela (período pelo início da conversa + origem)
  const convs = (typeof DADOS !== 'undefined' && DADOS && DADOS.conversas) || [];
  const [de, ate] = intervalo(convs);
  const porConversa = {};
  for (const c of convs) {
    const id = String(c.chave || '').split(':')[0];
    if (!porConversa[id] || c.inicio > porConversa[id].inicio) porConversa[id] = c;
  }
  return (LISTA || []).map(l => Object.assign({}, l, {s: porConversa[l.conversa_id] || null}))
    .filter(l => l.s && (S.o === 'todas' || (l.s.origem || 'lp') === S.o))
    .filter(l => { const d = diaBR(new Date(l.s.inicio)); return d >= de && d <= ate; })
    .sort((a, b) => ((b.ultima || {}).em || b.s.ultimo || '').localeCompare((a.ultima || {}).em || a.s.ultimo || ''));
}
function desenhar() {
  const box = document.getElementById('leads'); if (!box) return;
  if (typeof DADOS === 'undefined' || !DADOS) { box.innerHTML = ''; return; }
  let corpo;
  if (ERRO && !LISTA) corpo = `<div class="vazio">${ESC(ERRO)}</div>`;
  else if (!LISTA) corpo = '<div class="vazio">Buscando os contatos no Pipedrive…</div>';
  else {
    const ls = linhas();
    corpo = !ls.length ? '<div class="vazio">Nenhum lead neste período com este filtro.</div>' :
      `<div class="tw"><table class="lt"><thead><tr><th>Lead</th><th>WhatsApp</th><th>Origem</th><th>Início</th><th>Resultado</th><th>Última mensagem</th><th></th></tr></thead><tbody>` +
      ls.map(l => {
        const r = RES[l.s.status] || RES.conversando;
        const nome = l.nome_cadastro || l.nome_whatsapp || 'Sem nome';
        const apelido = l.nome_whatsapp && l.nome_whatsapp.toLowerCase() !== nome.toLowerCase() ? `<small>no WhatsApp: ${ESC(l.nome_whatsapp)}</small>` : '';
        const u = l.ultima;
        return `<tr><td class="ln"><b>${ESC(nome)}</b>${apelido}</td><td class="nw">${ESC(fone(l.telefone))}</td>
          <td class="nw">${(l.s.origem || 'lp') === 'site' ? 'Botão do site' : 'LP Diagnóstico'}</td>
          <td class="nw">${dataHora(l.s.inicio)}</td>
          <td class="nw"><span class="rs" style="--c:${r[1]}">${r[0]}</span>${l.s.abandono ? '<small>parou de responder</small>' : ''}</td>
          <td class="lu">${u ? `<span>${u.dir === 'inbound' ? '<b>Lead:</b> ' : ''}${ESC(u.preview || '[mídia]')}</span><small>${ha(u.em)}</small>` : '–'}</td>
          <td><button class="vb" data-conv="${ESC(l.conversa_id)}">Ver conversa</button></td></tr>`;
      }).join('') + '</tbody></table></div>';
  }
  box.innerHTML = `<div class="card lcard"><div class="lhead"><div><h3>Leads atendidos pelo bot</h3>
    <div class="c-s">Nome e WhatsApp de quem conversou com o Atendente, com o mesmo período e origem dos filtros acima</div></div>
    ${LISTA ? `<span class="lct">${linhas().length} lead${linhas().length === 1 ? '' : 's'}</span>` : ''}</div>${corpo}</div>`;
}

/* ---------------- prévia da conversa ---------------- */
async function abrir(id) {
  const l = (LISTA || []).find(x => x.conversa_id === id) || {};
  const s = linhas().find(x => x.conversa_id === id);
  const nome = l.nome_cadastro || l.nome_whatsapp || 'Lead';
  const r = RES[(s && s.s.status) || 'conversando'];
  let dlg = document.getElementById('cvd');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'cvd'; document.body.appendChild(dlg);
    dlg.addEventListener('click', ev => { if (ev.target === dlg || ev.target.closest('[data-fechar]')) dlg.close(); }); }
  dlg.innerHTML = `<div class="cv"><div class="cvh"><div><b>${ESC(nome)}</b><span>${ESC(fone(l.telefone))}${l.nome_whatsapp && l.nome_whatsapp !== nome ? ' · no WhatsApp: ' + ESC(l.nome_whatsapp) : ''}</span></div>
    <span class="rs" style="--c:${r[1]}">${r[0]}</span>
    ${l.deal_id ? `<a class="cvp" href="https://meupatrimoniob2c.pipedrive.com/deal/${encodeURIComponent(l.deal_id)}" target="_blank" rel="noopener">Abrir no Pipedrive</a>` : ''}
    <button class="cvx" data-fechar aria-label="Fechar">×</button></div>
    <div class="cvb" id="cvb"><div class="vazio">Carregando as mensagens…</div></div>
    <div class="cvf">Só leitura. Para responder, use o WhatsApp no Pipedrive.</div></div>`;
  dlg.showModal();
  const j = await chamar({acao: 'mensagens', conversa_id: id});
  const b = document.getElementById('cvb'); if (!b) return;
  if (j.erro) { b.innerHTML = `<div class="vazio">${ESC(j.erro)}</div>`; return; }
  const ms = j.mensagens || [];
  if (!ms.length) { b.innerHTML = '<div class="vazio">Nenhuma mensagem nesta conversa.</div>'; return; }
  let ultDia = '', h = '';
  for (const m of ms) {
    const d = dia(m.em); if (d !== ultDia) { h += `<div class="cvd">${ESC(d)}</div>`; ultDia = d; }
    const txt = m.texto ? ESC(m.texto).replace(/\n/g, '<br>') : '';
    const midia = m.tipo && m.tipo !== 'text' ? `<i>[${ESC(TIPO[m.tipo] || m.tipo)}]</i>${txt ? '<br>' : ''}` : '';
    const quem = m.de === 'bot' ? 'Atendente (bot)' : m.de === 'equipe' ? ESC(m.quem || 'Equipe') : m.de === 'modelo' ? 'Modelo de retomada' : m.de === 'automacao' ? 'Automação do Pipedrive' : ESC(primeiroNome(nome));
    h += `<div class="mg ${m.de}"><div class="mb"><small>${quem}</small>${midia}${txt || (midia ? '' : '<i>[sem texto]</i>')}<em>${hora(m.em)}</em></div></div>`;
  }
  b.innerHTML = h; b.scrollTop = b.scrollHeight;
}

document.addEventListener('click', ev => {
  const v = ev.target.closest('button[data-conv]'); if (v) abrir(v.dataset.conv);
});
// a tela principal redesenha os resultados quando muda filtro ou chegam dados novos: redesenha a lista junto
if (typeof render === 'function') {
  const original = render;
  render = function () { const r = original.apply(this, arguments); desenhar(); return r; };   // eslint-disable-line no-func-assign
}
window.Leads = {
  iniciar() { carregarLista(); clearInterval(window.__leadsT); window.__leadsT = setInterval(() => { if (!document.hidden) carregarLista(); }, 2 * 60 * 1000); },
  _teste(lista, msgs) { LISTA = lista; desenhar(); if (msgs) window.__msgsTeste = msgs; },
};
const app = document.getElementById('app');
if (app && !app.classList.contains('hidden') && lerSessao()) window.Leads.iniciar();
})();
