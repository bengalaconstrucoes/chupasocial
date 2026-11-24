# ChupaSocial

Rede social completa: feed cronológico, perfis e seguidores, curtidas, comentários,
reposts, mensagens privadas em tempo real, notificações, comunidades com moderação e
busca unificada.

Aplicação Next.js (App Router) com Supabase como infraestrutura (Auth, PostgreSQL,
Storage e Realtime) e deploy na Vercel.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end / servidor | Next.js 15 (App Router, Server Actions, React 19) |
| Estilo | Tailwind CSS v4 com tokens próprios (tema claro/escuro) |
| Banco | PostgreSQL 17 (Supabase) com RLS em todas as tabelas |
| Autenticação | Supabase Auth (e-mail + senha, confirmação, recuperação) |
| Arquivos | Supabase Storage (avatares, banners, mídia de posts, comunidades) |
| Tempo real | Supabase Realtime (mensagens e notificações) |
| Deploy | Vercel (produção + preview por branch) |

## Funcionalidades

- **Contas** — cadastro com e-mail/senha, confirmação de e-mail, login, logout,
  recuperação e troca de senha, desativação e exclusão definitiva da conta.
- **Perfis** — arroba único, nome, bio, site, foto, banner, data de entrada,
  contadores de seguidores/seguindo/publicações.
- **Privacidade** — perfil privado com solicitações de seguir; a visibilidade é
  aplicada por políticas RLS, não apenas pela interface.
- **Feed** — texto e até 4 imagens por publicação, feed cronológico geral e feed de
  quem você segue, carregamento progressivo, edição e exclusão.
- **Interações** — curtidas, comentários com respostas, reposts e compartilhamento
  por link.
- **Mensagens** — conversas individuais, histórico persistente, não lidas, atualização
  em tempo real e marcação de leitura.
- **Notificações** — seguidores, solicitações, curtidas, comentários, respostas,
  reposts, mensagens e entradas em comunidades; estado lida/não lida.
- **Comunidades** — criar, entrar/sair, publicar, listar membros, papéis de dono,
  moderador e membro, edição e moderação.
- **Busca** — pessoas, publicações e comunidades em abas separadas.

## Arquitetura

```
app/                      rotas (App Router) e páginas
  (auth)/                 login, cadastro, recuperação de senha
  auth/confirm/route.ts   troca de token/link de e-mail por sessão
  u/[username]/           perfil, seguidores, seguindo
  post/[id]/              publicação + comentários
  messages/[id]/          conversa
  communities/[slug]/     comunidade e administração
  settings/               perfil, privacidade e conta
components/               UI (shell, composer, post, comentários, formulários)
lib/actions/              Server Actions (todas as mutações)
lib/queries.ts            leitura de dados no servidor
lib/supabase/             clientes browser/servidor e refresh de sessão
supabase/migrations/      migrations SQL versionadas
```

**Regra de ouro:** nenhuma chave secreta no front-end. O app usa apenas a chave pública
(`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Toda escrita acontece com a sessão do usuário e passa
pelas políticas RLS — a `service_role` não é usada pela aplicação.

### Banco de dados

Tabelas: `profiles`, `posts`, `post_media`, `likes`, `comments`, `follows`,
`follow_requests`, `conversations`, `conversation_members`, `messages`,
`notifications`, `communities`, `community_members`.

Inclui chaves estrangeiras com cascata, restrições de integridade, índices (inclusive
GIN/trigram para busca), triggers de notificação, contadores de mídia, anti-spam por
janela de tempo e funções `SECURITY DEFINER` para operações atômicas
(`get_or_create_conversation`, `respond_follow_request`, `delete_own_account`).

### Segurança (RLS)

- RLS habilitado em todas as tabelas; `anon` não lê nada do schema `public`.
- Perfis privados: publicações, listas de seguidores e dados só aparecem para
  seguidores aprovados ou para o próprio dono.
- Mensagens e conversas: apenas membros da conversa.
- Notificações: apenas o destinatário; inserção somente por triggers internos.
- Comunidades: leitura pública autenticada, escrita pelo criador/moderadores.
- Storage: leitura pública das imagens (feed rápido) e escrita restrita à pasta do
  usuário (`<uid>/arquivo`), validada por política.
- Anti-spam: limites por usuário para publicações, comentários, mensagens e follows.

## Rodando localmente

```bash
bun install
cp .env.example .env.local     # preencha URL e chave pública do Supabase
bun dev
```

Abra `http://localhost:3000`.

### Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..."
```

Nenhuma outra variável é necessária para a aplicação. Scripts locais de teste usam,
opcionalmente, `SUPABASE_SERVICE_ROLE_KEY` (nunca versionar e nunca usar no app).

### Banco de dados

As migrations em `supabase/migrations/` são versionadas e aplicadas na ordem:

```
0001_init.sql              tabelas, restrições, índices, perfil automático
0002_functions_triggers.sql funções, RPCs, anti-spam, notificações, realtime
0003_rls.sql               RLS e políticas de acesso
0004_storage.sql           buckets + políticas de storage
0005_grants_utils.sql      privilégios de execução e disponibilidade de @
0006_profile_card.sql      cabeçalho público de perfil
```

Aplicar com a CLI do Supabase (`supabase db push`) ou pelo SQL Editor do painel, na
ordem dos arquivos.

### Auth no Supabase

- **Site URL**: URL de produção da Vercel.
- **Redirect URLs**: `https://SEU-DOMINIO/auth/confirm`, `http://localhost:3000/auth/confirm`.
- Confirmação de e-mail ativada (o cadastro redireciona para a tela de login com aviso).

## Deploy (Vercel)

1. Repositório no GitHub.
2. Projeto na Vercel com framework Next.js (build `next build`).
3. Variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em
   Production, Preview e Development.
4. Cada push na branch principal gera deploy de produção; branches geram previews.

## Qualidade e testes

- `bun run typecheck` — TypeScript estrito.
- `bun run build` — build de produção.
- Verificações funcionais cobertas: cadastro/login, publicação e exclusão, curtidas,
  comentários e respostas, seguidores, mensagens, notificações, permissões RLS
  (isolamento entre contas) e rotas inexistentes.

## Estrutura de pastas (resumo)

```
app/            páginas e rotas
components/     componentes de UI (servidor e cliente)
lib/            ações, consultas, tipos, utilitários e clientes Supabase
supabase/       migrations SQL
```

## Licença

Projeto privado — todos os direitos reservados.
