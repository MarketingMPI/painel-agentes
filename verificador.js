/* Verificador: conversas paradas há mais de 24 h, separadas por categoria, com a situação no Pipedrive. */
(function () {
'use strict';
const TZ = 'America/Sao_Paulo';
// situação = quem falou por último (calculado pelas mensagens) + leitura da IA para encerrada / consultor prometido
const CAT = {
  lead_sem_resposta: ['Mandou mensagem e ninguém respondeu', '#e5484d'],
  consultor_prometido: ['Passado ao consultor, sem contato', '#c2410c'],
  so_modelo: ['Só recebeu o "Podemos retomar?"', '#f5a524'],
  aguardando_automacao: ['Só a mensagem automática', '#8b5cf6'],
  aguardando_bot: ['Bot falou, lead não respondeu', '#0f9f9a'],
  aguardando_consultor: ['Consultor falou, lead não respondeu', '#3b6fd8'],
  encerrada: ['Encerrada', '#16a34a'],
};
const TIPO = {lead: 'Leads', cliente_aluno: 'Clientes e alunos', parceiro_interno: 'Parceiros e internos', spam: 'Spam'};
const NAO_CONSULTOR = ['Ninguém', 'Marketing', 'Atendente (bot)', 'celular', 'equipe', '', null, undefined];
const SIT = {negocio_aberto: 'Negócio aberto', sem_negocio_aberto: 'Só negócio fechado', pessoa_sem_negocio: 'Cadastrado sem negócio', fora_do_pipedrive: 'Fora do Pipedrive'};
const ST = {open: 'aberto', won: 'ganho', lost: 'perdido', excluido: 'excluído'};
let D = null, ERRO = '', F = {cat: 'todas', tipo: 'lead', aberto: false};   // começa fechado: só os grandes números

function fone(n) {
  n = String(n || '').replace(/\D/g, '');
  if (n.startsWith('55') && n.length >= 12) { const dd = n.slice(2, 4), r = n.slice(4); return '(' + dd + ') ' + (r.length === 9 ? r.slice(0, 5) + '-' + r.slice(5) : r.slice(0, 4) + '-' + r.slice(4)); }
  return n ? '+' + n : '–';
}
function parada(iso) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  return h < 48 ? h + ' h' : Math.floor(h / 24) + ' dias';
}
const dataHora = iso => new Intl.DateTimeFormat('pt-BR', {timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}).format(new Date(iso)).replace(',', '');

async function ler() {
  let x = lerSessao(); if (!x) return;
  if (Date.now() > x.x - 60000) { x = await renova(x); if (!x) return; }
  let r = await sb('/rest/v1/rpc/verificador_painel', {body: {}, token: x.a});
  if (r.status === 401) { x = await renova(x); if (!x) return; r = await sb('/rest/v1/rpc/verificador_painel', {body: {}, token: x.a}); }
  if (r.ok && r.j) { D = r.j; ERRO = ''; } else if (!D) ERRO = 'Não consegui ler o Verificador agora.';
  desenhar();
}

function pipedrive(p) {
  p = p || {};
  const ns = p.negocios || [];
  if (!ns.length) return `<span class="vf-sit ${p.situacao === 'fora_do_pipedrive' ? 'fora' : ''}">${SIT[p.situacao] || '–'}</span>`;
  return ns.slice(0, 2).map(n => `<div class="vf-neg"><a href="https://meupatrimoniob2c.pipedrive.com/deal/${encodeURIComponent(n.id)}" target="_blank" rel="noopener">${ESC(n.funil)}</a>
    <small>${ESC(n.etapa || '')}${n.etapa ? ' · ' : ''}${ST[n.status] || ESC(n.status)}${n.dono ? ' · ' + ESC(n.dono) : ''}</small></div>`).join('') +
    (ns.length > 2 ? `<small>+${ns.length - 2} negócio(s)</small>` : '');
}

function comQuem(c) {
  const q = c.com_quem || 'Ninguém';
  if (q === 'celular') return '<span class="vf-sit">Equipe (celular)</span>';
  if (q === 'Ninguém') return '<span class="vf-sit fora">Ninguém</span>';
  return `<b>${ESC(q)}</b>${NAO_CONSULTOR.includes(q) ? '' : '<small>consultor</small>'}`;
}
function desenhar() {
  const box = document.getElementById('verificador'); if (!box) return;
  const todas = (D && D.conversas) || [];
  const doTipo = todas.filter(c => F.tipo === 'todos' || (c.tipo || 'lead') === F.tipo);
  const cont = k => doTipo.filter(c => c.categoria === k).length;
  const lista = doTipo.filter(c => F.cat === 'todas' || c.categoria === F.cat);
  const leads = todas.filter(c => (c.tipo || 'lead') === 'lead');
  const semResp = leads.filter(c => c.categoria === 'lead_sem_resposta' || c.categoria === 'consultor_prometido').length;
  const comConsultor = leads.filter(c => !NAO_CONSULTOR.includes(c.com_quem)).length;
  const foraPd = leads.filter(c => ['fora_do_pipedrive', 'pessoa_sem_negocio'].includes((c.pipedrive || {}).situacao)).length;
  let corpo;
  if (ERRO && !D) corpo = `<div class="vazio">${ESC(ERRO)}</div>`;
  else if (!D) corpo = '<div class="vazio">Carregando…</div>';
  else if (!todas.length) corpo = '<div class="vazio">Nenhuma conversa parada separada ainda. O Verificador roda a cada 30 minutos, das 7h às 22h.</div>';
  else corpo = `
    <div class="vf-kpis">
      <div><b>${leads.length}</b><span>leads com conversa parada há mais de 24 h</span></div>
      <div class="alerta"><b>${semResp}</b><span>leads que mandaram mensagem e ficaram sem resposta</span></div>
      <div><b>${comConsultor}</b><span>leads já com um consultor</span></div>
      <div><b>${foraPd}</b><span>leads sem negócio no Pipedrive</span></div>
    </div>
    ${!F.aberto ? `<div class="vf-ver"><button class="vf-tudo" data-vabrir="1">Ver tudo <span>${todas.length} conversas</span></button></div>` : `
    <div class="vf-fil">
      <div class="seg">${[['lead', TIPO.lead], ['cliente_aluno', TIPO.cliente_aluno], ['parceiro_interno', TIPO.parceiro_interno], ['spam', TIPO.spam], ['todos', 'Todos']]
        .map(([k, v]) => `<button data-vtipo="${k}" class="${F.tipo === k ? 'on' : ''}">${v} (${k === 'todos' ? todas.length : todas.filter(c => (c.tipo || 'lead') === k).length})</button>`).join('')}</div>
    </div>
    <div class="vf-fil">
      <div class="seg"><button data-vcat="todas" class="${F.cat === 'todas' ? 'on' : ''}">Todas as situações (${doTipo.length})</button>${
        Object.entries(CAT).filter(([k]) => cont(k)).map(([k, v]) => `<button data-vcat="${k}" class="${F.cat === k ? 'on' : ''}"><i style="background:${v[1]}"></i>${v[0]} (${cont(k)})</button>`).join('')}</div>
    </div>
    ${!lista.length ? '<div class="vazio">Nenhuma conversa com esse filtro.</div>' : `<div class="tw"><table class="lt vf"><thead><tr><th>Contato</th><th>Parada há</th><th>Situação</th><th>Com quem está</th><th>Pipedrive</th><th>Contexto</th><th></th></tr></thead><tbody>${
      lista.map(c => {
        const ct = CAT[c.categoria] || ['–', '#9aa3ab'];
        const neg = ((c.pipedrive || {}).negocios || [])[0];
        return `<tr><td class="ln"><b>${ESC(c.nome_whatsapp || 'Sem nome')}</b><small>${ESC(fone(c.telefone))}</small>${(c.tipo || 'lead') !== 'lead' ? `<small>${ESC(TIPO[c.tipo] || '')}</small>` : ''}</td>
          <td class="nw"><b>${parada(c.ultima_msg_em)}</b><small>desde ${dataHora(c.ultima_msg_em)}</small></td>
          <td><span class="rs vf-rs" style="--c:${ct[1]}">${ct[0]}</span>${c.detalhe ? `<small class="vf-esp">${ESC(c.detalhe)}</small>` : ''}${c.interesse && c.interesse !== 'indefinido' ? `<small>interesse ${c.interesse === 'medio' ? 'médio' : ESC(c.interesse)}</small>` : ''}</td>
          <td class="nw">${comQuem(c)}</td>
          <td class="vf-pd">${pipedrive(c.pipedrive)}</td>
          <td class="vf-ctx"><b>${ESC(c.assunto || '')}</b><span>${ESC(c.resumo || '')}</span>${c.perfil_citado ? `<small>Perfil citado: ${ESC(c.perfil_citado)}</small>` : ''}${(c.resumo || '').length > 170 ? '<small class="vf-mais">ver resumo completo</small>' : ''}</td>
          <td><button class="vb" data-vconv="${ESC(c.conversa_id)}" data-vneg="${neg ? ESC(neg.id) : ''}">Ver conversa</button></td></tr>`;
      }).join('')}</tbody></table></div>`}
    <div class="vf-ver"><button class="vf-tudo fechar" data-vabrir="0">Recolher</button></div>`}`;
  box.innerHTML = `<div class="card vfcard"><div class="lhead"><div><h3>Verificador · conversas paradas</h3>
    <div class="c-s">Conversas do WhatsApp sem movimento há mais de 24 h. A situação vem de quem falou por último; a IA resume o contexto. Não depende dos filtros de cima.</div></div>
    ${D && D.gerado ? `<span class="lct">atualizado ${dataHora(D.gerado)}</span>` : ''}</div>${corpo}</div>`;
}

document.addEventListener('click', ev => {
  const c = ev.target.closest('[data-vcat]'), q = ev.target.closest('[data-vtipo]'), v = ev.target.closest('[data-vconv]');
  const ctx = ev.target.closest('.vf-ctx');
  if (ctx) { ctx.classList.toggle('aberto'); const m = ctx.querySelector('.vf-mais'); if (m) m.textContent = ctx.classList.contains('aberto') ? 'mostrar menos' : 'ver resumo completo'; }
  const ab = ev.target.closest('[data-vabrir]');
  if (ab) { F.aberto = ab.dataset.vabrir === '1'; desenhar();
    if (!F.aberto) { const el = document.getElementById('verificador'); if (el) el.scrollIntoView({block: 'nearest'}); } }
  if (c) { F.cat = c.dataset.vcat; desenhar(); }
  if (q) { F.tipo = q.dataset.vtipo; F.cat = 'todas'; desenhar(); }
  if (v && window.Leads) {
    const item = ((D && D.conversas) || []).find(x => x.conversa_id === v.dataset.vconv) || {};
    const ct = CAT[item.categoria] || ['Conversa parada', '#9aa3ab'];
    Leads.abrir(v.dataset.vconv, {nome_whatsapp: item.nome_whatsapp, telefone: item.telefone, deal_id: v.dataset.vneg || null, rotulo: ct});
  }
});
window.Verificador = {
  iniciar() { ler(); clearInterval(window.__vfT); window.__vfT = setInterval(() => { if (!document.hidden) ler(); }, 2 * 60 * 1000); },
  _teste(d) { D = d; desenhar(); },
};
const app = document.getElementById('app');
if (app && !app.classList.contains('hidden') && lerSessao()) window.Verificador.iniciar();
})();
