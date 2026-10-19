# Lanche Coletivo · GDG Aracaju

App para organizar o **coffee break coletivo** dos eventos do GDG Aracaju: a pessoa entra com a conta Google, escolhe o que leva (quantidade e sabor/marca) e acompanha o que ainda falta. Primeiro uso: Coding Jam de Halloween, 31/10/2026, UNINASSAU.

Sem servidor próprio e sem Cloud Functions (plano **Spark**, gratuito): o app roda no navegador e fala direto com o Firestore. Quem garante as regras (sem estourar a meta, sem mexer na contribuição dos outros, só organização edita itens) são as **Security Rules** do servidor, em `firestore.rules`, cobertas por testes.

O plano completo, com o modelo de dados, as rules e as decisões de projeto, está em [`docs/PLANO.md`](docs/PLANO.md).

## Stack

React 19 + Vite + TypeScript (strict) · Tailwind v4 · react-router · Firebase (Auth Google, Firestore, Hosting) · Vitest + `@firebase/rules-unit-testing` + Emulator Suite (exige **JDK 21+**) · oxlint.

## Rodando localmente

Pré-requisitos: Node 20+ e **Java 21+** (para os emuladores).

```bash
npm install
cp .env.example .env.local        # já vem com VITE_USE_EMULATORS=true
npm run emulators                 # terminal 1: Auth (9099) + Firestore (8080), projeto "demo-lanche-coletivo"
npm run dev                       # terminal 2: http://localhost:5173
```

No emulador o login Google é simulado. Para virar admin localmente, crie o documento `admins/{uid}` pela UI do emulador (http://localhost:4000) ou pela API REST do emulador. O `uid` aparece em `/perfil`.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `preview` | servidor de desenvolvimento / build de produção / pré-visualização |
| `npm run typecheck` / `lint` | TypeScript / oxlint |
| `npm run test:unit` | testes unitários (lógica pura, sem emulador) |
| `npm run test:rules` | Security Rules + integração, num emulador próprio (portas separadas de `npm run emulators`) |

## Publicando (Firebase)

1. **Projeto**: no [console do Firebase](https://console.firebase.google.com), crie um projeto (Analytics pode ficar desligado). Mantenha o plano **Spark**.
2. **Firestore**: *Build → Firestore Database → Criar banco de dados*, modo **produção** e localização **`southamerica-east1` (São Paulo)**. ⚠️ A região **não pode ser mudada depois**.
3. **Authentication**: *Build → Authentication → Provedor de login → Google → Ativar*. Escolha um e-mail de suporte (aparece na tela de consentimento do Google). Em *Configurações → Domínios autorizados*, confira que `<projectId>.web.app` e `<projectId>.firebaseapp.com` estão na lista.
4. **App Web**: registre um app Web (sem Hosting) e copie a configuração para `.env.production` (não vai para o Git; modelo em `.env.example`):
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=<projectId>.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=<projectId>
   VITE_FIREBASE_APP_ID=...
   VITE_USE_EMULATORS=false
   ```
   A chave de API do app Web **não é segredo** (só identifica o projeto; quem protege os dados são as rules). Já uma *service account* (`*-adminsdk-*.json`) **nunca** deve ser commitada.
5. **Projeto no CLI**: ajuste o `.firebaserc` com o `projectId` e faça `npx firebase login`.
6. **Deploy, nesta ordem** (as rules antes do site):
   ```bash
   npm run build
   npx firebase deploy --only firestore:rules,firestore:indexes
   npx firebase deploy --only hosting
   ```

### Primeiro admin

As rules **não deixam o app criar admins** — só o console. Entre no site com a sua conta, abra `/perfil` e copie o UID. No console: *Firestore → Iniciar coleção* `admins`, ID do documento = o UID, campo `criadoEm` (timestamp). Recarregue: o menu **Admin** aparece. Repita para cada organizador (convém ter mais de um).

## Usando como organização

Em `/admin`: criar o evento a partir do template do Halloween (nasce como **rascunho**), **publicar**, encerrar contribuições. Em cada evento (`/admin/e/:id`): lacunas por categoria, **reabrir o prazo**, cancelamentos tardios, remover contribuição, bloquear pessoas, exportar o texto para o WhatsApp e CSV, e **Editar itens e metas** (`/admin/e/:id/itens`): criar, editar, reordenar e remover itens; criar, renomear e remover categorias; editar os dados do evento. Quando um item já tem contribuições, a tela impede mudanças que as invalidariam (por exemplo, meta abaixo do reservado ou remover um sabor já escolhido).

Há também um botão para criar uma **cópia de teste** do Halloween (`teste-halloween`), útil para ensaiar em produção sem sujar o evento real.

## Estrutura

```
firestore.rules          regras de segurança (a verdade do sistema)
src/lib/                 lógica de domínio: pledges, itens, categorias, evento, exportação (puro e testado)
src/pages/               telas públicas e de administração
src/components/          componentes compartilhados
src/templates/           template do Coding Jam de Halloween
tests/rules/             testes das rules e de integração contra o emulador
docs/PLANO.md            plano, modelo de dados, decisões e notas de implementação
```

## Segurança e privacidade

- Só o **primeiro nome** aparece para os participantes; o e-mail fica visível apenas para a organização (CSV) e é usado só para o evento.
- Contribuições passam por transação no cliente **e** são revalidadas pelas rules (contadores, limites, prazo, bloqueios).
- Opcional: **App Check** para dificultar abuso automatizado do Firestore.
