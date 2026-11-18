# Painel dos Agentes · Meu Patrimônio

Painel para acompanhar os agentes de IA da Meu Patrimônio. Hoje mostra a **Patrícia**, o bot que atende e requalifica os leads no WhatsApp.

- No ar: https://marketingmpi.github.io/painel-agentes/
- Acesso: conta do Supabase MP GLOBAL, a mesma do Painel Operacional. Só e-mails @meupatrimonio.com confirmados.

## De onde vêm os dados
- Este repositório **não guarda nenhum dado**: a página lê ao vivo a função `public.agentes_painel()` do Supabase com o login de quem está usando.
- Quem grava é o n8n: a Patrícia registra cada turno em `public.bot_turnos` (função `bot_turno_registrar`), e o Monitor registra quando a equipe assume a conversa.
- A tabela não tem dado pessoal: só o id da conversa no Pipedrive, a origem (LP ou site), o modo (normal, lembrete, abandono), o status e o horário.
- SQL, carga do histórico e fluxos: pasta `Automações/Bot Requalificação WhatsApp/` (arquivo `supabase/painel_agentes.sql`).

## Escritório dos agentes
Cena 2D no topo com os 5 agentes (Patrícia, Monitor, Validador, Cérebro e Verificador): trabalhando, de plantão, dormindo (fora do horário), com erro, atrasado ou desligado.
- Dados: função `public.agentes_status()`, alimentada a cada minuto pelo fluxo do n8n "[AGENTES] Painel - Status dos agentes" (`build_status.py`).
- Código: `escritorio.js` e `escritorio.css`.

## Agente MP PRO · conversas sobre o MP PRO

Seção `#mppro` (`mppro.js` e `mppro.css`), logo antes do Verificador. Lê a RPC `mppro_painel()` (Supabase MP GLOBAL, tabela `mppro_turnos`, gravada pelo fluxo n8n "[AGENTES] WhatsApp - MP PRO (atendimento)"). Começa fechada, só com os números (conversas, profissionais que receberam o link, alunos passados à equipe, investidores levados ao Diagnóstico, em andamento); "Ver tudo" abre a lista com perfil, resultado, resumo e "Ver conversa". No escritório, o MP PRO é o 6º robô (champagne, com "PRO" no peito).

## Verificador · conversas paradas
Todas as conversas do WhatsApp sem resposta há mais de 24 h, separadas por categoria (lead esperando resposta, lead sumiu, cliente/operacional, parceiro/interno, encerrada, spam), com quem parou, a situação no Pipedrive (funil, etapa, dono) e o resumo do contexto.
- Dados: função `public.verificador_painel()`, alimentada a cada 30 min (7h-22h) pelo fluxo "[AGENTES] WhatsApp - Verificador (conversas paradas)" (`build_verificador.py`). O Verificador só lê e separa.
- Código: `verificador.js` e `verificador.css`.

## Leads atendidos pelo bot
Lista com nome e WhatsApp de quem conversou com a Patrícia (mesmos filtros de período e origem) e botão "Ver conversa" com as mensagens, só leitura.
- Os dados vêm ao vivo do Pipedrive pelo webhook do n8n `POST /webhook/painel-conversas` (fluxo "[AGENTES] Painel - API das conversas", `build_conversas_api.py`).
- O webhook exige o token de login (conta @meupatrimonio.com confirmada), só abre conversas que o bot conduziu e não guarda nada nas execuções do n8n.
- Código: `conversas.js` e `conversas.css`.

## Métricas
Cada conversa entra no período pela data em que começou.
- **Requalificado:** o bot viu que o lead tem perfil e passou para um consultor.
- **Fora do perfil:** o lead recebe o link dos materiais educacionais e vai para a Base de Relacionamento.
- **Pararam de responder:** o lead ficou mais de 24 h sem responder e o bot encerrou sozinho. Já está somado em requalificados ou fora do perfil.
- **Taxa de requalificação:** requalificados ÷ (requalificados + fora do perfil).
- **Passaram para a equipe:** alguém do time assumiu a conversa antes de o bot decidir.

## Pré-visualizar sem login
`python _preview.py` gera `_preview.html` (fora do git): o painel real com a sessão e as RPCs
simuladas por um stub de `window.fetch`, para abrir em `file://` e conferir o visual sem precisar
da conta Supabase. Nenhum dado real sai daqui.

## A persona
O rosto da Patrícia é `assets/patricia.svg`: ilustração vetorial **original**, criada para a MP.
Não usar foto nem rosto de pessoa real como persona comercial — exige cessão de direito de imagem
(Código Civil art. 20) e cria risco reputacional para uma consultoria regulada.
A personalidade dela está documentada no Obsidian em `SweetFox/Cérebro MP/Patrícia - Persona.md`.

## Variantes de layout
`sketches/` guarda as três direções visuais comparadas antes de escolher o layout atual
(híbrido: hero da persona + régua densa de métricas). São descartáveis, servem de referência.
