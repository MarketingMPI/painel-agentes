# Gera _preview.html: o painel real com login e dados simulados, para olhar o visual em file://
import io, os, json, base64, random, datetime

BASE = r"C:\Users\phenr\painel-agentes"
html = io.open(os.path.join(BASE, "index.html"), encoding="utf-8").read()

# --- dados simulados ---
hoje = datetime.datetime.now()
def iso(d): return d.strftime("%Y-%m-%dT%H:%M:%S.000Z")
random.seed(7)
STATUS = ["requalificado", "desqualificado", "sem_interesse", "humano", "indicacao", "conversando"]
PESOS  = [26, 44, 7, 9, 5, 9]
ORIG   = ["lp", "lp", "lp", "site", "indique"]
convs = []
for i in range(190):
    d = hoje - datetime.timedelta(days=random.randint(0, 29), hours=random.randint(0, 10))
    st = random.choices(STATUS, weights=PESOS)[0]
    convs.append({"ref": "c%d" % i, "inicio": iso(d), "status": st, "origem": random.choice(ORIG),
                  "abandono": random.random() < .18, "lembrete": random.random() < .3, "voltou": random.random() < .4})

agentes = [{"id": a, "ativo": True,
            "ultima": {"em": iso(hoje - datetime.timedelta(minutes=random.randint(0, 4))), "status": "success"},
            "trabalho": {"em": iso(hoje - datetime.timedelta(minutes=random.randint(1, 30))), "texto": t},
            "erros_24h": 0}
           for a, t in [("cerebro", "aprendeu com 2 conversas"), ("atendente", "respondeu um lead"),
                        ("monitor", "auditou 3 conversas"), ("validador", "conferiu o Monitor"),
                        ("verificador", "separou 12 conversas paradas"), ("mppro", "mandou o link do MP PRO")]]

mppro = {"turnos": [{"ref": "m%d" % i, "em": iso(hoje - datetime.timedelta(days=random.randint(0, 20))),
                     "perfil": random.choice(["profissional", "aluno", "investidor", "curioso"]),
                     "status": random.choice(["link_enviado", "aluno_suporte", "investidor", "conversando"]),
                     "nome": "Contato %d" % i, "telefone": "+5527999%04d" % i,
                     "resumo": "Consultor de investimentos, queria entender o que vem na assinatura.",
                     "conversa_id": "x%d" % i} for i in range(23)]}

verif = {"conversas": [{"id": "v%d" % i, "nome": "Lead %d" % i, "telefone": "+5527998%04d" % i,
                        "tipo": random.choice(["lead", "lead", "cliente_aluno", "parceiro_interno"]),
                        "situacao": random.choice(["lead_sem_resposta", "aguardando_consultor", "so_modelo", "aguardando_bot"]),
                        "com_quem": random.choice(["Atendente (bot)", "Victor Carvalho", "Marketing", "Ninguém"]),
                        "assunto": "Diagnóstico financeiro", "detalhe": "nunca foi respondido",
                        "resumo": "Lead pediu o diagnóstico e não recebeu retorno depois do modelo.",
                        "parada_desde": iso(hoje - datetime.timedelta(days=random.randint(1, 9))),
                        "encerrada": False} for i in range(14)]}

leads = {"leads": [{"id": "c%d" % i, "nome": "Lead Exemplo %d" % i, "telefone": "+5527997%04d" % i,
                    "inicio": iso(hoje - datetime.timedelta(days=random.randint(0, 20)))} for i in range(18)]}

# JWT falso só para a tela passar do login (assinatura não é verificada no front)
payload = base64.urlsafe_b64encode(json.dumps({"email": "marketing@meupatrimonio.com"}).encode()).decode().rstrip("=")
jwt = "x." + payload + ".y"
sessao = {"a": jwt, "r": "r", "x": 9999999999999, "e": "marketing@meupatrimonio.com"}

stub = """
<script>
/* PREVIEW LOCAL - dados simulados, nada sai daqui */
try { localStorage.setItem('mp-agentes-sessao', %s); } catch(e){}
const __D = %s;
const __rota = u => {
  u = String(u);
  if (u.includes('agentes_painel'))    return {conversas: __D.convs, gerado: new Date().toISOString()};
  if (u.includes('agentes_status'))    return {agentes: __D.agentes};
  if (u.includes('mppro_painel'))      return __D.mppro;
  if (u.includes('verificador_painel'))return __D.verif;
  if (u.includes('painel-conversas'))  return __D.leads;
  if (u.includes('/auth/v1/'))         return {access_token: __D.sessao.a, refresh_token:'r', expires_in: 3600};
  return {};
};
const __f = window.fetch;
window.fetch = async (u, o) => {
  const alvo = (u && u.url) || u;
  if (/supabase\\.co|n8n\\.meupatrimonio\\.com/.test(String(alvo)))
    return new Response(JSON.stringify(__rota(alvo)), {status:200, headers:{'Content-Type':'application/json'}});
  return __f(u, o);
};
</script>
""" % (json.dumps(json.dumps(sessao)), json.dumps({"convs": convs, "agentes": agentes, "mppro": mppro,
                                                   "verif": verif, "leads": leads, "sessao": sessao}, ensure_ascii=False))

# injeta o stub logo depois de <body> (antes de qualquer script da página)
out = html.replace("<body>", "<body>\n" + stub, 1)
# CSP bloqueia o Response/fetch? nao, mas remove a meta pra evitar ruido no file://
out = out.replace('<meta http-equiv="Content-Security-Policy"', '<meta name="csp-desligado-no-preview" data-x="')
io.open(os.path.join(BASE, "_preview.html"), "w", encoding="utf-8").write(out)
print("ok _preview.html", len(out), "chars;", len(convs), "conversas simuladas")
