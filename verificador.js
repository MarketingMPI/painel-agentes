/* Verificador: conversas paradas há mais de 24 h, separadas por categoria, com a situação no Pipedrive. */
(function () {
'use strict';
const TZ = 'America/Sao_Paulo';
const CAT = {
  lead_esperando: ['Lead esperando resposta', '#e5484d'],
  lead_sumiu: ['Lead sumiu', '#f5a524'],
  cliente_operacional: ['Cliente / operacional', '#3b6fd8'],
  parceiro_interno: ['Parceiro / interno', '#8b5cf6'],
  encerrada: ['Encerrada', '#16a34a'],
  spam_engano: ['Spam / engano', '#9aa3ab'],
};
const SIT = {negocio_aberto: 'Negócio aberto', sem_negocio_aberto: 'Só negócio fechado', pessoa_sem_negocio: 'Cadastrado sem negócio', fora_do_pipedrive: 'Fora do Pipedrive'};
const ST = {open: 'aberto', won: 'ganho', lost: 'perdido', excluido: 'excluído'};
let D = null, ERRO = '', F = {cat: 'todas', quem: 'todos'};

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

function desenhar() {
  const box = document.getElementById('verificador'); if (!box) return;
  const todas = (D && D.conversas) || [];
  const cont = k => todas.filter(c => c.categoria === k).length;
  const lista = todas.filter(c => (F.cat === 'todas' || c.categoria === F.cat) && (F.quem === 'todos' || c.quem_parou === F.quem));
  const esperando = todas.filter(c => c.quem_parou === 'equipe').length;
  const fora = todas.filter(c => (c.pipedrive || {}).situacao === 'fora_do_pipedrive' || (c.pipedrive || {}).situacao === 'pessoa_sem_negocio').length;
  let corpo;
  if (ERRO && !D) corpo = `<div class="vazio">${ESC(ERRO)}</div>`;
  else if (!D) corpo = '<div class="vazio">Carregando…</div>';
  else if (!todas.length) corpo = '<div class="vazio">Nenhuma conversa parada separada ainda. O Verificador roda a cada 30 minutos, das 7h às 22h.</div>';
  else corpo = `
    <div class="vf-kpis">
      <div><b>${todas.length}</b><span>conversas paradas há mais de 24 h</span></div>
      <div class="alerta"><b>${esperando}</b><span>com o lead esperando a gente</span></div>
      <div><b>${todas.length - esperando}</b><span>esperando o lead</span></div>
      <div><b>${fora}</b><span>sem negócio no Pipedrive</span></div>
    </div>
    <div class="vf-fil">
      <div class="seg" id="vf-cat"><button data-vcat="todas" class="${F.cat === 'todas' ? 'on' : ''}">Todas (${todas.length})</button>${
        Object.entries(CAT).filter(([k]) => cont(k)).map(([k, v]) => `<button data-vcat="${k}" class="${F.cat === k ? 'on' : ''}"><i style="background:${v[1]}"></i>${v[0]} (${cont(k)})</button>`).join('')}</div>
      <div class="seg" id="vf-quem"><button data-vquem="todos" class="${F.quem === 'todos' ? 'on' : ''}">Todos</button><button data-vquem="equipe" class="${F.quem === 'equipe' ? 'on' : ''}">Lead esperando a gente</button><button data-vquem="lead" class="${F.quem === 'lead' ? 'on' : ''}">Esperando o lead</button></div>
    </div>
    ${!lista.length ? '<div class="vazio">Nenhuma conversa com esse filtro.</div>' : `<div class="tw"><table class="lt vf"><thead><tr><th>Contato</th><th>Parada há</th><th>Categoria</th><th>Pipedrive</th><th>Contexto</th><th></th></tr></thead><tbody>${
      lista.map(c => {
        const ct = CAT[c.categoria] || ['–', '#9aa3ab'];
        const neg = ((c.pipedrive || {}).negocios || [])[0];
        return `<tr><td class="ln"><b>${ESC(c.nome_whatsapp || 'Sem nome')}</b><small>${ESC(fone(c.telefone))}</small></td>
          <td class="nw"><b>${parada(c.ultima_msg_em)}</b><small>${c.quem_parou === 'equipe' ? '<span class="vf-esp">lead esperando a gente</span>' : 'esperando o lead'}</small><small>desde ${dataHora(c.ultima_msg_em)}</small></td>
          <td class="nw"><span class="rs" style="--c:${ct[1]}">${ct[0]}</span>${c.interesse && c.interesse !== 'indefinido' ? `<small>interesse ${c.interesse === 'medio' ? 'médio' : ESC(c.interesse)}</small>` : ''}</td>
          <td class="vf-pd">${pipedrive(c.pipedrive)}</td>
          <td class="vf-ctx"><b>${ESC(c.assunto || '')}</b><span>${ESC(c.resumo || '')}</span>${c.perfil_citado ? `<small>Perfil citado: ${ESC(c.perfil_citado)}</small>` : ''}${(c.resumo || '').length > 170 ? '<small class="vf-mais">ver resumo completo</small>' : ''}</td>
          <td><button class="vb" data-vconv="${ESC(c.conversa_id)}" data-vneg="${neg ? ESC(neg.id) : ''}">Ver conversa</button></td></tr>`;
      }).join('')}</tbody></table></div>`}`;
  box.innerHTML = `<div class="card vfcard"><div class="lhead"><div><h3>Verificador · conversas paradas</h3>
    <div class="c-s">Todas as conversas do WhatsApp sem resposta há mais de 24 h, com a situação no Pipedrive e o contexto separado pela IA. Não depende dos filtros de cima.</div></div>
    ${D && D.gerado ? `<span class="lct">atualizado ${dataHora(D.gerado)}</span>` : ''}</div>${corpo}</div>`;
}

document.addEventListener('click', ev => {
  const c = ev.target.closest('[data-vcat]'), q = ev.target.closest('[data-vquem]'), v = ev.target.closest('[data-vconv]');
  const ctx = ev.target.closest('.vf-ctx');
  if (ctx) { ctx.classList.toggle('aberto'); const m = ctx.querySelector('.vf-mais'); if (m) m.textContent = ctx.classList.contains('aberto') ? 'mostrar menos' : 'ver resumo completo'; }
  if (c) { F.cat = c.dataset.vcat; desenhar(); }
  if (q) { F.quem = q.dataset.vquem; desenhar(); }
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
