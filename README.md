# Painel dos Agentes · Meu Patrimônio

Painel para acompanhar os agentes de IA da Meu Patrimônio. Hoje mostra o **Atendente**, o bot que faz a requalificação dos leads no WhatsApp.

- No ar: https://marketingmpi.github.io/painel-agentes/
- Acesso: conta do Supabase MP GLOBAL, a mesma do Painel Operacional. Só e-mails @meupatrimonio.com confirmados.

## De onde vêm os dados
- Este repositório **não guarda nenhum dado**: a página lê ao vivo a função `public.agentes_painel()` do Supabase com o login de quem está usando.
- Quem grava é o n8n: o Atendente registra cada turno em `public.bot_turnos` (função `bot_turno_registrar`), e o Monitor registra quando a equipe assume a conversa.
- A tabela não tem dado pessoal: só o id da conversa no Pipedrive, a origem (LP ou site), o modo (normal, lembrete, abandono), o status e o horário.
- SQL, carga do histórico e fluxos: pasta `Automações/Bot Requalificação WhatsApp/` (arquivo `supabase/painel_agentes.sql`).

## Escritório dos agentes
Cena 2D no topo com os 4 agentes (Atendente, Monitor, Validador e Cérebro): trabalhando, de plantão, dormindo (fora do horário), com erro, atrasado ou desligado.
- Dados: função `public.agentes_status()`, alimentada a cada minuto pelo fluxo do n8n "[AGENTES] Painel - Status dos agentes" (`build_status.py`).
- Código: `escritorio.js` e `escritorio.css`.

## Métricas
Cada conversa entra no período pela data em que começou.
- **Requalificado:** o bot viu que o lead tem perfil e passou para um consultor.
- **Fora do perfil:** o lead recebe o link dos materiais educacionais e vai para a Base de Relacionamento.
- **Pararam de responder:** o lead ficou mais de 24 h sem responder e o bot encerrou sozinho. Já está somado em requalificados ou fora do perfil.
- **Taxa de requalificação:** requalificados ÷ (requalificados + fora do perfil).
- **Passaram para a equipe:** alguém do time assumiu a conversa antes de o bot decidir.
