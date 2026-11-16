/* Agente MP PRO: conversas de quem falou do MP PRO no WhatsApp (dúvidas, link, alunos passados à equipe). */
(function () {
'use strict';
const TZ = 'America/Sao_Paulo';
const ST = {
  aluno_suporte: ['Aluno passado à equipe', '#b42318'],
  humano: ['Passou para a equipe', '#c2410c'],
  link_enviado: ['Recebeu o link', '#b8962e'],
  investidor: ['Levado ao Diagnóstico', '#3b6fd8'],
  sem_interesse: ['Sem interesse', '#9aa3ab'],
  conversando: ['Em andamento', '#16a34a'],
};
const PERFIL = {profissional: 'Profissional', aluno: 'Aluno', investidor: 'Investidor', curioso: 'Começando do zero', outro: 'Outro assunto'};
let D = null, ERRO = '', F = {st: 'todas', aberto: false};   // começa fechado: só os grandes números

const fone = n => { n = String(n || '').replace(/\D/g, '');
  if (n.startsWith('55') && n.length >= 12) { const dd = n.slice(2, 4), r = n.slice(4); return '(' + dd + ') ' + (r.length === 9 ? r.slice(0, 5) + '-' + r.slice(5) : r.slice(0, 4) + '-' + r.slice(4)); }
  return n ? '+' + n : '–'; };
const dataHora = iso => new Intl.DateTimeFormat('pt-BR', {timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}).format(new Date(iso)).replace(',', '');

async function ler() {
  let x = lerSessao(); if (!x) return;
  if (Date.now() > x.x - 60000) { x = await renova(x); if (!x) return; }
  let r = await sb('/rest/v1/rpc/mppro_painel', {body: {}, token: x.a});
  if (r.status === 401) { x = await renova(x); if (!x) return; r = await sb('/rest/v1/rpc/mppro_painel', {body: {}, token: x.a}); }
  if (r.ok && r.j) { D = r.j; ERRO = ''; } else if (!D) ERRO = 'Não consegui ler o agente MP PRO agora.';
  desenhar();
}

function desenhar() {
  const box = document.getElementById('mppro'); if (!box) return;
  const todas = (D && D.conversas) || [];
  const n = k => todas.filter(c => c.status === k).length;
  const lista = todas.filter(c => F.st === 'todas' || c.status === F.st);
  let corpo;
  if (ERRO && !D) corpo = `<div class="vazio">${ESC(ERRO)}</div>`;
  else if (!D) corpo = '<div class="vazio">Carregando…</div>';
  else corpo = `
    <div class="vf-kpis mp-kpis">
      <div><b>${todas.length}</b><span>conversas sobre o MP PRO</span></div>
      <div class="mp-ouro"><b>${n('link_enviado')}</b><span>profissionais que receberam o link</span></div>
      <div class="${n('aluno_suporte') ? 'alerta' : ''}"><b>${n('aluno_suporte')}</b><span>alunos passados para a equipe</span></div>
      <div><b>${n('investidor')}</b><span>investidores levados ao Diagnóstico</span></div>
      <div><b>${n('conversando')}</b><span>em andamento</span></div>
    </div>
    ${!todas.length ? '<div class="vazio">Ninguém falou do MP PRO no WhatsApp desde que o agente começou (16/11). Ele responde das 8h às 20h, todos os dias.</div>'
    : !F.aberto ? `<div class="vf-ver"><button class="vf-tudo" data-mabrir="1">Ver tudo <span>${todas.length} conversa${todas.length > 1 ? 's' : ''}</span></button></div>` : `
    <div class="vf-fil"><div class="seg"><button data-mst="todas" class="${F.st === 'todas' ? 'on' : ''}">Todas (${todas.length})</button>${
      Object.entries(ST).filter(([k]) => n(k)).map(([k, v]) => `<button data-mst="${k}" class="${F.st === k ? 'on' : ''}"><i style="background:${v[1]}"></i>${v[0]} (${n(k)})</button>`).join('')}</div></div>
    ${!lista.length ? '<div class="vazio">Nenhuma conversa com esse filtro.</div>' : `<div class="tw"><table class="lt vf mp"><thead><tr><th>Contato</th><th>Última mensagem</th><th>Perfil</th><th>Resultado</th><th>Resumo para a equipe</th><th></th></tr></thead><tbody>${
      lista.map(c => { const s = ST[c.status] || ST.conversando;
        return `<tr><td class="ln"><b>${ESC(c.nome_whatsapp || 'Sem nome')}</b><small>${ESC(fone(c.telefone))}</small></td>
          <td class="nw">${dataHora(c.ultimo)}<small>${c.mensagens || 0} mensagem(ns) do bot</small></td>
          <td class="nw">${ESC(PERFIL[c.perfil] || '–')}${c.aluno_cadastro ? `<small>assinatura: ${ESC(c.aluno_cadastro)}</small>` : ''}</td>
          <td><span class="rs vf-rs" style="--c:${s[1]}">${s[0]}</span></td>
          <td class="vf-ctx"><span>${ESC(c.resumo || '')}</span>${(c.resumo || '').length > 170 ? '<small class="vf-mais">ver resumo completo</small>' : ''}</td>
          <td><button class="vb" data-mconv="${ESC(c.conversa_id)}">Ver conversa</button></td></tr>`; }).join('')}</tbody></table></div>`}
    <div class="vf-ver"><button class="vf-tudo fechar" data-mabrir="0">Recolher</button></div>`}`;
  box.innerHTML = `<div class="card vfcard mpcard"><div class="lhead"><div><h3><span class="mp-tag">MP PRO</span> Conversas sobre o MP PRO</h3>
    <div class="c-s">Quem escreveu "MP PRO" no WhatsApp. O agente tira dúvidas com a base do Cérebro, manda o link para quem quer entrar e passa aluno com problema para a equipe (tarefa no Pipedrive e e-mail para o Marketing).</div></div>
    ${D && D.gerado ? `<span class="lct">atualizado ${dataHora(D.gerado)}</span>` : ''}</div>${corpo}</div>`;
}

document.addEventListener('click', ev => {
  const ab = ev.target.closest('[data-mabrir]'), st = ev.target.closest('[data-mst]'), v = ev.target.closest('[data-mconv]');
  if (ab) { F.aberto = ab.dataset.mabrir === '1'; desenhar(); if (!F.aberto) { const el = document.getElementById('mppro'); if (el) el.scrollIntoView({block: 'nearest'}); } }
  if (st) { F.st = st.dataset.mst; desenhar(); }
  if (v && window.Leads) {
    const item = ((D && D.conversas) || []).find(x => x.conversa_id === v.dataset.mconv) || {};
    Leads.abrir(v.dataset.mconv, {nome_whatsapp: item.nome_whatsapp, telefone: item.telefone, deal_id: null, rotulo: ST[item.status] || ST.conversando});
  }
});
window.MpPro = {
  iniciar() { ler(); clearInterval(window.__mpT); window.__mpT = setInterval(() => { if (!document.hidden) ler(); }, 2 * 60 * 1000); },
  _teste(d) { D = d; desenhar(); },
};
const app = document.getElementById('app');
if (app && !app.classList.contains('hidden') && lerSessao()) window.MpPro.iniciar();
})();
