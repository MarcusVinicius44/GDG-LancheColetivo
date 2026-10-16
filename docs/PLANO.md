# Lanche Coletivo GDG Aracaju — Plano v3 (12 correções + ajustes v3 + refinamentos v4)

## Contexto
Coffee break comunitário de TODOS os eventos do GDG Aracaju (1º uso: Coding Jam de Halloween, 31/10/2026 08h30, UNINASSAU). A pessoa entra com Google, escolhe o que levar (qtd + sabor) e o **servidor (Security Rules)** garante: sem estouro de meta, sem contador burlado, sem mexer em pledge alheia. Spark: sem Functions/billing. Produção até ~21/10 (hoje 16/10). Repo vazio (só `refs/`).

Estilo GDG (a página do evento não expõe paleta): #4285F4 #EA4335 #FBBC04 #34A853, fundo claro, cards `rounded-2xl`, botões pill, motivo `< >`, Roboto/Open Sans, acento Halloween opcional (tema do evento, não do app).

## Stack
React 19 + Vite + TS strict · Tailwind v4 (`@tailwindcss/vite`, tokens GDG em `@theme`) · react-router (versão atual instalada: v8; import de `react-router`) · Firebase Web SDK modular (Auth Google, Firestore, Hosting) · react-hook-form + zod (só UX; a verdade são as rules) · Vitest + `@firebase/rules-unit-testing` + Emulator Suite (**JDK 21+**) · oxlint (padrão do template Vite atual) · `tsx` + `firebase-admin` **apenas para emulador** · datas via `Intl` com `America/Fortaleza`. Sem Functions, sem Storage. App Check opcional (README).

## Modelo de dados (Firestore, região **southamerica-east1**)
```
admins/{uid}                 { criadoEm }                    // escrita só pelo console
blocked/{uid}                { motivo, em }                  // admin escreve; admin E o próprio uid leem
users/{uid}                  { nome, primeiroNome, email, ultimoLogin }  // dono+admin; e-mail só aqui
events/{eid}
  titulo, descricao, local, inicio:Timestamp, prazoContribuicoes:Timestamp,
  inscritos (informativo), publicoPlanejado (default 90), margem (%, default 0),
  maxNecessidadesPorPessoa, status 'rascunho'|'aberto'|'fechado', criadoEm
  /needs/{nid}
     nome, categoria(7), unidade (explícita), meta, reservado,
     minPorPessoa, maxPorPessoa, opcoes[], maxPorOpcao|null,
     opcoesNorm[] (norm de cada opção; máx. 12 opções),
     reservadoPorOpcao{opcao:int} (todas as opções com 0), permiteOutro,
     nota, tags[], ordem, ultimoUid|null
  /pledges/{nid}_{uid}
     needId, uid, qty(int), opcao|null, textoOutro|null(≤40), primeiroNome,
     devolverAoFinal, criadoEm, atualizadoEm
  /participants/{uid}        { ativas, ultimoNeedId }        // nada sensível; leitura dono+admin
  /cancelamentos/{nid}_{uid} { needId, uid, primeiroNome, qty, em }   // log de cancelamento/redução pós-prazo
```
Regras de domínio:
- Quantidades **inteiras**; fracionário vira pacote ("pacote 500g").
- Meta sugerida (correção 1): `ceil(round(perCapita × publicoPlanejado × (1+margem/100), 6))` — o `round(…,6)` evita 10,0000001→11. `perCapita` em `src/config/consumo.ts` como fração `[num, den]`, calibrado para reproduzir o seed com público 90 e margem 0. Admin edita livremente.
- "Outro": conta na meta; com `opcoes=[]` e `permiteOutro=true`, `textoOutro` é detalhe opcional (ex.: "qual salgado?"); com opções, `opcao` XOR `textoOutro`; **`textoOutro` cuja forma normalizada ∈ `opcoesNorm` é negado** (UI sugere selecionar a opção existente). Não entra em `maxPorOpcao` (limite honesto: "Outro: Coca" escapa do cap por sabor, mas nunca da meta; admin modera).
- **Correção 3**: em create/update de need, se `!permiteOutro && opcoes.size()>0 && maxPorOpcao!=null` então `opcoes.size()*maxPorOpcao >= meta` (rule + UI).
- Meta < reservado: **impedido** (rule+UI). Com reservado>0, `opcoes` só podem ser acrescentadas. Need só apaga com reservado==0. Evento não é apagado (usa `fechado`).
- `primeiroNome` (correção 7): `nomeEsperado() = n = token.get('name','').trim().split(' ')[0]; (1<=n.size()<=40) ? n : 'Participante'`. Mesma função no cliente (`lib/format.ts`), testada para paridade.
- Prazo (correção 4), evento sempre `aberto`: antes do prazo: criar/editar/aumentar/reduzir/cancelar. Após `prazoContribuicoes` e antes de `inicio`: **só reduzir (qty≥min) ou cancelar**; `opcao/textoOutro` imutáveis; reduzir/cancelar exige gravar `cancelamentos/{nid}_{uid}` no mesmo commit (qty acumulada = Σ liberada). Após `inicio`: usuário não escreve nada. Painel de lacunas destaca cancelamentos tardios.
- Bloqueado: não cria/aumenta; pode cancelar/reduzir.

## Security Rules (invariante nos DOIS lados, via `getAfter`)
Helpers: `isAdmin()`, `signedIn()` (provider `google.com` + `email_verified`), `notBlocked()`, `ev(eid)`, `delta(pledgeBefore,pledgeAfter)`.
- **pledge** (create/update/delete pelo dono; admin só **delete**): id==`needId_uid`, uid==auth.uid, tipos/tamanhos, imutáveis (needId, uid, criadoEm, primeiroNome), timestamps==`request.time`, min/max, opção válida, `getAfter(need).reservado == get(need).reservado + delta` e `<= meta`, contadores por opção (chaves afetadas ⊆ {opçãoAntes, opçãoDepois}) e `maxPorOpcao` em aumentos, `participant.ativas_depois == antes ± 1` e `<= maxNecessidadesPorPessoa`, janelas de prazo/início acima, log de cancelamento tardio.
- **need update**: *config* (só admin) — contadores e `ultimoUid` intactos, `meta>=reservado`, regra da correção 3; *contador* (qualquer autenticado, **inclusive admin**) — só `reservado, reservadoPorOpcao, ultimoUid`; `reservado_depois == antes + delta(pledge needId_ultimoUid)`; **o write de contador só é aceito se a pledge `{nid}_{ultimoUid}` realmente mudou no mesmo commit (`getAfter != get`, por existência ou dados)**; sem pledge alterada ⇒ negado (inclusive delta 0). **Correção 2:** admin não tem atalho: para remover pledge alheia faz delete da pledge + need com `ultimoUid`=dono + participant do dono, mesma fórmula. Nunca config+contador no mesmo write.
- **participant**: `ativas_depois == antes + (pledge ultimoNeedId existe depois ?1:0) − (existia antes ?1:0)`, ≥0, sem delete; admin segue a mesma fórmula.
- **cancelamentos**: create/update só com a pledge reduzida/apagada no mesmo commit e após o prazo; `qty == antes.qty + (qtyBefore − qtyAfter)`.
- **Leitura**: events≠rascunho (rascunho: admin), needs/pledges seguem o evento, participants/users: dono+admin, blocked: dono+admin, admins: dono.
- Orçamento de acessos (≤20 em batch/transação): medido nos testes. Piores casos a medir: **redução pós-prazo com log de cancelamento** (pledge, need, participant, cancelamento, evento, blocked, admin, ±`getAfter`s) e **remoção pela admin** (delete da pledge alheia + need + participant do dono + `isAdmin`); seed/duplicar em lotes de ≤8 needs por batch (**correção 11**).
- **Cliente** (`lib/pledges.ts`): `runTransaction` lê need+pledge+participant, calcula, grava (valores literais, sem `increment`). **Correção 9:** `ABORTED/failed-precondition` ⇒ retry automático (SDK) e, esgotado, mensagem "Muita gente ao mesmo tempo — tentar de novo"; `permission-denied` ⇒ relê estado e diagnostica (esgotou / prazo / limite de itens / bloqueado) em pt-BR com botão "Tentar de novo".

## Auth (correções 5 e 6)
`signInWithPopup`; `lib/inAppBrowser.ts` detecta WhatsApp/Instagram/Facebook/FBAN/Line/etc. e mostra tela "Abra no navegador" + botão copiar link (Google bloqueia OAuth em webview). `authDomain` = domínio do Hosting (ou custom + `/__/auth` do Hosting) para o redirect fallback funcionar no Safari. Firestore criado em **southamerica-east1** — passo crítico no README (não muda depois).

## Telas
Público: `/` eventos; `/e/:id` necessidades por categoria, progresso, quem leva o quê, modal "Quero levar", "Minhas contribuições". Admin: CRUD evento/need, **duplicar evento** (lotes, contadores zerados), **"Criar a partir de template"** (Halloween, correção 11), lacunas por categoria (+ cancelamentos tardios), remover pledge, bloquear uid, CSV (com e-mail via `users`), texto WhatsApp "quem leva o quê" e "o que falta", recalcular metas.

## Seed Halloween — `src/templates/halloween.ts` (público 90, margem 0)
Usado pelo botão do admin (passa pelas rules) e, só no emulador, por `scripts/seed-emulator.ts` (firebase-admin). Evento `rascunho`, `maxNecessidadesPorPessoa=2`, prazo 29/10 18h e início 31/10 08h30 (Fortaleza).
- Bebidas: Refrigerante garrafa 2L **10** (Coca/Guaraná Antarctica/Fanta, maxPorOpcao 4, outro) · Suco 1L **12** (uva/morango/abacaxi/laranja, maxPorOpcao 4) — *água e gelo mantidos removidos (decisão final)*
- Café & Cia: Café pronto garrafa térmica 1L **14** (devolver) · Leite 1L **6** · Açúcar pacote 1kg **3** · Adoçante frasco **2** · Copinhos de café pacote 50un **4** · Mexedores pacote **2**
- Salgados: Salgados unidade **330** (min 25, max 100; `permiteOutro` p/ detalhar) · Salgado vegano unidade **30** (tag vegano)
- Doces: Bolo inteiro **6** (macaxeira/cenoura/chocolate/fubá/laranja, maxPorOpcao 2, outro) · Docinhos unidade **100** · Bolo sem glúten/lactose **1**
- Pães & Frios: Pão unidade **140** · Queijo pacote 500g **5** · Presunto/peito de peru pacote 500g **4** · Manteiga pote **3** · Requeijão pote **3**
- Descartáveis: Pratos unidade **150** · Copos 200ml unidade **300** · Guardanapos pacote 50un **8** · Talheres unidade **100**
- Diversos: Faca (devolver) **2** · Saco de lixo pacote **2** · Papel toalha rolo **2**
Checagem automática (teste unitário do template): correção 3 passa para todos (Suco: 4×4=16≥12 ✔).

## Ajustes v3 (aprovados após v2)
1. **Contador só com pledge realmente alterada**: write de `reservado/reservadoPorOpcao` exige `getAfter(pledge {nid}_{ultimoUid}) != get(...)` (existência ou dados mudaram) além da fórmula do delta. Teste: contador com delta 0 e pledge inalterada ⇒ negado.
2. **`opcoesNorm`** no need (lowercase, sem acento, trim). Rule do need valida `opcoesNorm[i]==norm(opcoes[i])` desenrolado para i<12 (**máx. 12 opções**) e `size` igual. `norm()` na rule = `lower().trim()` + `replace()` com classes regex por letra (menos expressões avaliadas): `'[áàâãä]'→'a'`, `'[éèêë]'→'e'`, `'[íìîï]'→'i'`, `'[óòôõö]'→'o'`, `'[úùûü]'→'u'`, `'ç'→'c'`, `'ñ'→'n'`. Pledge: `textoOutro` com `norm(textoOutro) ∈ opcoesNorm` ⇒ negado. Limite honesto: pontuação/espaços internos não são normalizados. UI sugere "já existe a opção X — selecione-a". Mesma `norm()` no cliente (teste de paridade).
3. **"Reabrir até…"** no painel de lacunas: admin estende `prazoContribuicoes` (rule: novo prazo ≤ `inicio`). Teste: após estender, criar pledge volta a ser permitido; logs de cancelamento tardio permanecem.
4. **"Meu perfil"** (`/perfil`): mostra uid + botão copiar; README explica como promover organizadores (criar `admins/{uid}` no console).
5. **Aviso de privacidade** curto no login e no modal "Quero levar" (primeiro nome público; e-mail só organização; uso só para o evento).
6. **Scaffold**: criar o Vite em pasta temporária e mover para a raiz (pasta tem `refs/` e `.git`); versões atuais (React 19, react-router 7 — importar de `react-router`). **Antes do passo 2: `java -version` ≥ 21.**
7. **Prioridade (produção 21/10)** — OBRIGATÓRIO: rules + testes D, E, F, G, H (+ os de ajustes 1–3); UI pública completa; admin mínimo = template Halloween, lacunas (+reabrir), remover pledge, bloquear, exportar WhatsApp/CSV, publicar evento. DEPOIS: CRUD completo de needs, duplicar evento, recalcular metas, testes A/C/I de borda. (A rule de need continua completa; só o CRUD na UI e testes de borda são adiados.)

## PASSO 1 — Scaffold (sem lógica de negócio)
1. Em pasta temporária: `npm create vite@latest tmp-app -- --template react-ts`; mover o conteúdo para a raiz (preservando `refs/`, `.git`); deps: `react-router firebase react-hook-form zod @hookform/resolvers`; dev: `tailwindcss @tailwindcss/vite vitest @firebase/rules-unit-testing firebase-tools firebase-admin tsx eslint typescript-eslint`.
2. `tsconfig` strict + `noUncheckedIndexedAccess`; alias `@/`.
3. `vite.config.ts` com plugin Tailwind; `src/index.css` com `@theme` (cores GDG, fontes Roboto/Open Sans via Google Fonts, raios).
4. `firebase.json`: Hosting (`dist`, rewrite `** → /index.html`), Firestore (rules/indexes), emulators (auth 9099, firestore 8080, ui 4000). `.firebaserc` com placeholder do `projectId`.
5. `.env.example` (`VITE_FIREBASE_API_KEY/AUTH_DOMAIN/PROJECT_ID/APP_ID…`, `VITE_USE_EMULATORS`), `.gitignore` (`.env*`, `*serviceAccount*.json`, `*-adminsdk-*.json`, `dist`, `.firebase`, `refs/` mantida).
6. `src/config/firebase.ts` (init + conexão aos emuladores via env), `AuthProvider` (`useAuth`: user, isAdmin, blockedDoc, upsert `users/{uid}`), `lib/inAppBrowser.ts`, `lib/format.ts` (`primeiroNome`, datas Fortaleza), layout com header GDG, roteador esqueleto (`/`, `/e/:id`, `/admin/*`).
7. Scripts npm: `dev`, `build`, `typecheck`, `lint`, `test:unit`, `test:rules` (= `firebase emulators:exec --only firestore "vitest run tests/rules"`), `emulators`, `seed:emulator`.
Critério de saída: `npm run typecheck && npm run build` verdes; login Google abre no emulador.

## PASSO 2 — `firestore.rules` + testes (TDD, antes de qualquer tela)
1. `tests/rules/harness.ts`: `initializeTestEnvironment` lendo `firestore.rules`; `clearFirestore` por teste; `fileParallelism:false`; contextos `alice, bob, carol, admin, bloqueada, semNome` com claims `{ name, email, email_verified, firebase:{sign_in_provider:'google.com'} }`; fixtures via `withSecurityRulesDisabled` (evento aberto com prazo futuro, `prazoPassado`, `eventoIniciado`, `rascunho`, `fechado`; needs: simples, com opções+maxPorOpcao, com meta 1, permiteOutro); helpers `writePledge()` (batch de 3–4 docs) para casos adversariais crus e uso do `lib/pledges.ts` real para o caminho feliz. `request.time` não é mockável ⇒ prazos relativos a `now`.
2. Escrever os testes (lista abaixo) **falhando**, depois implementar `firestore.rules` até verdes.
3. Medir contagem de acessos nos piores casos (**redução pós-prazo com log** e **remoção de pledge pelo admin**) e no lote de 8 needs.

### Lista completa de testes
**A. Identidade**: anônimo não escreve nada · provider ≠ google negado · `email_verified=false` negado · `users` com e-mail ≠ token negado · ler `users` alheio negado; admin lê · `primeiroNome` forjado negado · sem `token.name` ⇒ exige "Participante" · nome vazio/só espaços ⇒ "Participante" · nome com espaço inicial usa 1º token · 1º token >40 ⇒ "Participante" (paridade cliente×rule).
**B. Leitura**: público lê evento aberto/fechado, não rascunho (nem needs/pledges dele) · `participants` alheio negado, próprio ok, admin ok · `blocked/{meu uid}` ok, de outro negado · `admins/{uid}` próprio ok, escrita por qualquer um negada (inclusive admin).
**C. Evento/Need (admin)**: não-admin cria evento/need negado · admin cria need válida · create com `reservado≠0` / `reservadoPorOpcao` não zerado / `ultimoUid` preenchido negado · categoria/tag/status inválidos, strings gigantes, tipos errados, min>max, meta<=0 negados · **correção 3**: `!permiteOutro` e `opcoes×maxPorOpcao<meta` negado (create e update); com `permiteOutro` ok; sem `maxPorOpcao` ok · meta<reservado negado, meta==reservado ok · **admin alterando `reservado`/`reservadoPorOpcao` direto negado** · admin config+contador no mesmo write negado · remover opção com reservado>0 negado, acrescentar ok · delete need com reservado>0 negado, ==0 ok · edição de config não zera contadores · **need com 12 opções acentuadas (create e update) passa no limite de expressões; 13 opções negado** · `opcoesNorm` divergente de `norm(opcoes)` negado · prazo ("Reabrir até…"): estender ≤ `inicio` ok, > `inicio` negado, admin only.
**D. Criar pledge**: caminho feliz (pledge+need+participant) · id errado/uid≠auth/needId inexistente negados · need sem atualizar (contador não bate) negado · need atualizado sem pledge negado · delta errado (+2 com qty 1) negado · qty 0/negativa/fracionária/string/<min/>max negadas · **estouro de meta** negado · **última unidade**: qty 1 ok, qty 2 negado · opção fora da lista · sem opção quando há · opcao+textoOutro juntos · textoOutro sem permiteOutro · textoOutro 41 chars · **textoOutro ∈ opcoesNorm negado** ("guarana antarctica", "Guaraná  Antarctica" com caixa/acentos diferentes, espaços nas pontas) e texto realmente novo ok · **maxPorOpcao** no limite ok / +1 negado · **write de contador com delta 0 e pledge inalterada negado** · após "Reabrir até…", criar pledge volta a ser permitido · contadores por opção errados / terceira chave tocada negado · **maxNecessidadesPorPessoa** (2 ok, 3ª negada) · `participant.ativas` errado/sem pledge negado · timestamps ≠ `request.time` · campos extras · bloqueado negado · evento rascunho/fechado negado · após prazo negado.
**E. Editar pledge**: aumentar qty (+delta) ok · reduzir ok · **editar qty sem mexer no contador (burla)** negado · contador ±sem pledge negado · trocar sabor (2 chaves) ok; trocar tocando 3ª chave negado · pledge alheia negada · alterar uid/needId/criadoEm/primeiroNome negado · só `devolverAoFinal` (sem escrever need) ok · **pós-prazo**: aumentar negado, trocar opção negado, reduzir com log ok, reduzir sem log negado, `devolverAoFinal` ok, reduzir abaixo do min negado · pós-início negado · evento fechado negado · bloqueado: aumentar negado, reduzir ok.
**F. Cancelar**: feliz (delete+need−qty+participant−1) · sem decrementar negado · decrementar sem deletar negado · alheia negada · pós-prazo com log ok / sem log negado / log com qty errada negado / dois cancelamentos tardios acumulam · pós-início negado · `ativas` nunca <0.
**G. Concorrência (emulador real, `runTransaction` em `Promise.all`)**: duas pledges na última unidade ⇒ exatamente uma vence, outra recebe "esgotado", `reservado==meta` · 2 usuários na última vaga de uma opção (`maxPorOpcao`) · mesma pessoa clica 2× ⇒ 1 pledge, contador correto · edição simultânea de qty e cancelamento ⇒ estado consistente · invariante final `reservado == Σ pledges.qty` e `Σ reservadoPorOpcao + outro == reservado`.
**H. Admin**: remove pledge alheia (delete+need−qty com `ultimoUid`=dono+participant do dono −1) ok · mesma remoção **sem** atualizar contador negada · `ultimoUid` errado negado · participant do dono sem decremento negado · admin editar/criar pledge alheia negado · admin decrementar need sem deletar pledge negado · remoção pós-prazo sem log ok · admin bloqueia/desbloqueia; não-admin negado.
**I. Limites**: lote de 8 needs passa no limite de acessos · pior caso de pledge passa · duplicar evento em lotes.
**J. Unitários (sem emulador)**: metas (`1/9×90=10`, arredondamento, margem) · template Halloween (correção 3, metas == seed) · `primeiroNome` cliente = rule · formatação Fortaleza · `inAppBrowser` (UAs de WhatsApp/Instagram/Facebook) · mapeamento de erros de transação.

## Ordem restante
3. `lib/pledges.ts` + hooks · 4. UI pública · 5. UI admin (CRUD, duplicar, template, lacunas, CSV, WhatsApp) · 6. README (setup, **Firestore em southamerica-east1**, primeiro admin = criar `admins/{uid}` no console, `authDomain`, deploy: rules → hosting, nunca commitar service account) · 7. Deploy + teste manual com 2 contas reais.

## Verificação
`npm run test:rules` + `test:unit` verdes · `typecheck`/`lint`/`build` · emulador: seed via botão admin, 2 abas disputando a última unidade, editar/cancelar, prazo vencido, remover como admin e conferir `reservado==Σ qty` · mobile 360px · abrir link dentro do WhatsApp/Instagram (tela "abra no navegador") · pós-deploy: consulta anônima não vaza e-mail.

## Suposições
Você cria o projeto Firebase (preciso do `projectId`); primeiro admin = seu uid; categorias fixas (7); 1 pledge por pessoa por necessidade (outro sabor = editar a pledge).

## Notas de implementação — Passo 2 (16/10/2026)
`firestore.rules` + `tests/rules/*` (153 testes, A–I) verdes no emulador. Achados que o plano não previa:
- **`lower()` das rules só converte ASCII**: o `norm()` das rules inclui maiúsculas acentuadas nas classes (`[áàâãäÁÀÂÃÄ]`…); paridade com `lib/format.ts` continua (JS `toLowerCase` + mesmas classes).
- **Limite de 1000 expressões por avaliação** (não só de acessos): `opcoesNorm == norm(opcoes)` só é revalidado quando `opcoes/opcoesNorm` mudam (create ou edição de opções). Com `reservado>0`, as opções só podem ser acrescentadas **no fim da lista** (prefixo preservado) e as novas entram com contador 0. 12 opções acentuadas passam em create e update; 13 negado.
- **Corrida na última unidade**: o perdedor recebe `permission-denied` (rules avaliadas contra o estado já commitado), não `ABORTED`. O cliente deve tratar `permission-denied` como "reler e diagnosticar" (já previsto na correção 9).
- **Participant**: a pledge de criação exige `participant.ultimoNeedId == needId` (impede duas criações num mesmo commit com um só +1).
- Testes de transação (G) usam um helper local em `tests/rules/g-concorrencia.test.ts`; trocar pelo `lib/pledges.ts` real no Passo 3.
- `npm run test:rules` agora usa `--project demo-lanche-coletivo`; `tsconfig.node.json` usa `moduleResolution: bundler` + `strict`.

## Notas de implementação — Passo 3 (16/10/2026)
`lib/pledges.ts` + hooks prontos; 51 testes unitários e 163 de rules verdes; typecheck/build ok.
- **Arquitetura**: `lib/pledgeLogic.ts` (puro, espelha as rules: `planejarSalvar`, `planejarCancelar`, `novoContador`, `diagnosticarNegado`) → `lib/pledges.ts` (`salvarPledge`/`cancelarPledge` em `runTransaction`, valores literais, recebem o `db` por parâmetro) → `hooks/usePledgeActions.ts`. Erros em `lib/errors.ts` (`PledgeError` com `.code`, mensagem pt-BR, `.cause` = erro do SDK, `.detalhe` ex.: unidades restantes ou opção existente).
- **Correção 9 validada**: o perdedor da corrida recebe `permission-denied`; o cliente relê o estado (inclui `blocked/{uid}`) e devolve `esgotado`/`prazo`/`limite-itens`/`bloqueado`. `aborted`/`failed-precondition` ⇒ "Muita gente ao mesmo tempo — tentar de novo".
- **Rule nova**: `cancelamentos/{nid}_{uid}` agora é legível pelo dono (a transação precisa ler o log para acumular a qty); organização lê todos.
- **Hooks de leitura** (`hooks/useFirestore.ts`): `useEventos` (público usa `where status in [aberto,fechado]`; admin vê rascunhos), `useEvento`, `useNeeds`, `usePledges`, `usePledgesDe`, `useAgora`.
- **Logo**: `refs/GDGLogo.svg` (2,2 MB, coordenadas com 6 casas) otimizado para `src/assets/gdg-logo.svg` (33 KB); usado no header (`Layout.tsx`). O original fica em `refs/`.
- Testes G agora usam o `lib/pledges.ts` real; `tests/rules/lib-pledges.test.ts` cobre o caminho feliz de ponta a ponta contra as rules.

## Notas de implementação — Passo 4 (16/10/2026)
UI pública pronta e verificada no navegador contra os emuladores (criar → editar → cancelar passando pelas rules). 64 unitários + 165 de rules verdes.
- **Login local**: o SDK exige `authDomain` mesmo com emuladores (`auth/auth-domain-config-required`); `config/firebase.ts` usa `localhost` quando `VITE_USE_EMULATORS=true`. Dev precisa de `.env.local` (gitignored) com `VITE_USE_EMULATORS=true` e `VITE_FIREBASE_PROJECT_ID=demo-lanche-coletivo`.
- **Páginas**: `Home` (eventos + selo de fase), `EventPage` (resumo/progresso, "Minhas contribuições", necessidades por categoria, "Quem leva", aviso de privacidade, banner de login), `PledgeModal` (`<dialog>` nativo: opções com "faltam N", "Outro" com detecção de duplicata, quantidade, "devolver no final", erros pt-BR), `NeedCard`, `ProgressBar`, `PrivacyNote`. Helpers puros em `lib/needView.ts` e `lib/fase.ts`.
- **Antecipado do Passo 5** (para ter dados): `templates/halloween.ts` (25 itens; min/max por pessoa escolhidos por mim, ajustáveis), `lib/eventos.ts` (criar template em lotes de 8, publicar, encerrar) e `AdminHome` mínimo (criar template, publicar, encerrar, abrir).
- **Testes de rules** rodam com `firebase.test.json` (Firestore 8181, hub 4411): não conflita com `npm run emulators`.
- Observação: `useEventos` do admin lista também rascunhos; o público filtra por `status in [aberto, fechado]` (única forma das rules provarem a leitura da query).

## Notas de implementação — Passo 5, parte prioritária (16/10/2026)
Admin mínimo para produção pronto e verificado no navegador. 77 unitários + 169 de rules verdes.
- **Rota `/admin/e/:id`** (`pages/admin/AdminEvento.tsx`): resumo + **"Reabrir até…"** (`ReabrirPrazo`, datetime-local interpretado em Fortaleza, valida futuro e ≤ início), **lacunas** por categoria (mais descobertas primeiro), **cancelamentos tardios** (log lido da coleção `cancelamentos`), **contribuições** com *Remover* (via `cancelarPledge` com `donoUid`, sem prazo nem log) e *Bloquear/Desbloquear*, e **exportação** (`ExportPanel`): texto WhatsApp "quem leva o quê" e "o que falta" + CSV.
- **CSV** (`lib/exportar.ts`): separador `;`, BOM UTF-8, e-mail via `users`, e **neutralização de injeção de fórmula** (`= + - @` viram `'…`) porque `textoOutro` vem de usuários.
- **Rules**: `cancelamentos/{nid}_{uid}` legível pelo dono (sufixo do id) e pela organização; consultas de lista de `users`, `blocked` e `cancelamentos` pelo admin verificadas.
- Hooks da organização (`useBloqueios`, `useCancelamentos`, `useUsuarios`) só consultam quando `isAdmin`.
- **Ainda pendente do Passo 5 (adiado por prioridade)**: CRUD completo de needs na UI, duplicar evento, recalcular metas (`config/consumo.ts`, perCapita como fração calibrada p/ reproduzir o seed com público 90).

## Crabuntu, o mascote (16/10/2026)
Animação do mascote do GDG Aracaju ao confirmar, editar ou cancelar uma contribuição.
- `refs/Crabuntu.png` (971 KB) → `src/assets/crabuntu.webp` (50 KB, 480 px, com transparência).
- `components/Crabuntu.tsx` (`CrabuntuProvider`, toast fixo embaixo/à direita com balão, confetes de comida e dancinha; some sozinho em ~5 s ou ao clicar) + `hooks/useCrabuntu.ts` (`useCrabuntu().falar(momento, item)`) + `lib/crabuntu.ts` (falas por momento: `criou`/`editou`/`cancelou`, `{item}` vira o nome do item; testado). Animações em `index.css`, desligadas com `prefers-reduced-motion`. Disparado em `EventPage`.
- Para novas falas, editar `FRASES` em `lib/crabuntu.ts`.
