# RollDeck — Estúdio TTRPG Offline-First & API REST

O **RollDeck** é uma suíte completa para mesas de RPG de mesa (TTRPG), projetada com foco *mobile-first*, funcionamento 100% offline via IndexedDB + PWA e servidor Express integrado com autenticação local, RBAC e API REST documentada em OpenAPI 3.1.

---

## Principais Módulos

### 1. Rolador de Dados & Pacotes
- Dados padrão (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`) e dados customizados (incluindo faces de texto/Fate).
- Bandeja rápida, modificadores globais, vantagem/desvantagem, *keep highest/lowest* e rerrolagem de `1`.
- Pacotes favoritos organizáveis por categorias (Combate, Magias, Perícias, Geral) com histórico pesquisável e rolagens fixáveis.
- Feedback tátil (haptics), efeitos sonoros sintetizados e suporte a atalhos de teclado (`1`–`8` para navegar entre telas).

### 2. Mapa de Notas & Cartografia Interativa
- **Canvas infinito 60fps** com zoom/pan suave, LOD automático (orbes, badges e cartões detalhados), minimapa sincronizado, modo de física/gravidade de nós conectados (`d3-force`), Snap-to-Grid (`20px`) e **Modo Foco de Vizinhança**.
- **Fichas de Personagem integradas:** categoria dedicada `Ficha de Personagem` com criação rápida no mapa, retrato, raça/classe/nível, barra interativa de PV (`-5/-1/+1/+5` + PV temp), CA, iniciativa, atributos com cálculo automático de modificadores e salvaguardas, perícias, ataques, condições e inventário. Clique em qualquer atributo, perícia, iniciativa ou ataque para rolar direto no RollDeck.
- **Conexões & Wiki-Links:** suporte a `[[Nome da Nota]]` e `[[Nota|Rótulo]]` com autocomplete, atualização automática de referências ao renomear notas, backlinks clicáveis, links manuais estilizados (cor, tracejado, direção) e linha-guia dinâmica ao conectar nós.
- **Editor Markdown & Janelas Flutuantes:** prévia Markdown rica com checklists interativos, imagens e links clicáveis; qualquer nota ou ficha pode ser desacoplada em janela flutuante redimensionável que permanece aberta ao navegar por todo o app.
- **Desenho Vetorial SVG:** caneta livre com presets cartográficos (Livre, Rio, Trilha, Parede), gizmo interativo para mover/redimensionar/girar, controle de cor/espessura/opacidade/curva, integração com camadas e Undo/Redo (`Ctrl+Z` / `Ctrl+Y`).
- **Camadas, Molduras e Mapas de Fundo:** controle de visibilidade e bloqueio por camada, molduras de região arrastáveis/redimensionáveis/renomeáveis e múltiplas imagens/tokens posicionáveis no canvas.

### 3. Forja de Mundos & Gerador de Encontros
- Geração procedural determinística por *seed* (reprodutível): continentes/terreno, assentamentos (aldeia, vila, cidade com distritos e facções), masmorras (Donjon, BSP, Caverna), NPCs, itens e rumores.
- **Gerador de Encontros d20 / D&D 5.5 (2024):** orçamento de XP por nível e tamanho do grupo, dificuldades (Baixa, Moderada, Alta/Mortal), ambientes temáticos, composição tática de criaturas, tesouro sugerido e envio direto para o Mapa de Notas.

### 4. Gerador de Loot
- Tabelas customizáveis com múltiplos tipos de coluna (texto, números, moeda, fórmulas de dados, seleções), bloqueio de itens individuais, histórico de gerações e integração com o mapa.

### 5. Oráculo & Gestão de Campanha
- Oráculo Sim/Não determinístico com probabilidades, modificadores e eventos aleatórios.
- Tabelas de campanha (clima, rumores, complicações, comércio, desastres sazonais, NPCs rápidos), controlador de turnos, ficha de cidade e diário de campanha.

### 6. Integrações, Backup & Exportação
- **Obsidian:** importação de arquivos `.md` (com frontmatter YAML, `#tags`, `[[wiki-links]]` e detecção automática de categorias como fichas, NPCs e locais) e exportação completa do mapa em `.zip` de arquivos Markdown.
- **Notion:** busca e importação de páginas e databases diretamente pelo servidor (via `NOTION_API_KEY`) convertendo blocos e menções em notas e conexões no mapa.
- **Backup JSON:** exportação e importação validada com Zod nos modos *substituir* ou *mesclar*.

---

## Stack Tecnológica

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Zustand, Motion, Lucide Icons, D3-Force, MiniSearch, IndexedDB (`idb`), JSZip, `vite-plugin-pwa`.
- **Backend:** Node.js, Express 4, Zod v4, TypeScript (`tsx`).
- **Testes:** Vitest.

---

## Como Executar Localmente

### Pré-requisitos
- Node.js 20+ (ou Bun)

### Instalação e Execução
```bash
npm install
npm run dev
```

O servidor inicia na porta **`3000`** (`http://localhost:3000`), servindo simultaneamente o frontend React e a API REST `/api/*`.

### Scripts Disponíveis
| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor Express + Vite em modo desenvolvimento na porta 3000 |
| `npm run build` | Compila o bundle de produção em `dist/` |
| `npm run start` | Inicia o servidor em modo produção (`tsx server.ts`) |
| `npm run lint` | Executa checagem de tipos TypeScript (`tsc --noEmit`) |
| `npm run test` | Executa toda a suíte de testes unitários e de API (`vitest run`) |

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` caso queira customizar opções do servidor:

| Variável | Obrigatória | Descrição |
| :--- | :---: | :--- |
| `APP_URL` | Não | URL pública da instância (usada na especificação OpenAPI) |
| `ACCESS_TOKEN` | Não | Token inicial opcional (se vazio, o administrador define usuário/senha no primeiro acesso) |
| `CORS_ORIGINS` | Não | Lista separada por vírgula de origens externas autorizadas |
| `NOTION_API_KEY` | Não | Token de integração interna do Notion (usado apenas no servidor para importar páginas/databases) |

---

## Autenticação, RBAC & API REST v1

O RollDeck inclui controle de acesso por papéis (`admin`, `gm`, `player`, `viewer`), login simples por usuário/senha (sem e-mail) e geração de **Chaves de API externas (`rdk_...`)** com escopos granulares (`read`, `write`, `roll`, `generate`) em **Ajustes → API & Integrações**.

- **Especificação OpenAPI 3.1:** `GET /api/openapi.json`
- **Status do servidor:** `GET /api/health`
- **Índice da API:** `GET /api/v1`

### Principais Endpoints
- **Autenticação & Administração:** `/api/auth/login`, `/api/auth/me`, `/api/v1/users`, `/api/v1/keys`
- **CRUD de Recursos:** `/api/v1/notes`, `/api/v1/links`, `/api/v1/layers`, `/api/v1/frames`, `/api/v1/drawings`, `/api/v1/dice`, `/api/v1/packages`, `/api/v1/categories`, `/api/v1/history`, `/api/v1/loot-generators`, `/api/v1/loot-groups`
- **Motores RPG:** `POST /api/v1/roll`, `POST /api/v1/oracle`, `POST /api/v1/forja/world`, `POST /api/v1/forja/dungeon`, `POST /api/v1/forja/settlement`, `POST /api/v1/forja/npcs`, `POST /api/v1/forja/items`
- **Integrações & Sincronização:** `POST /api/v1/integrations/obsidian/import`, `GET /api/v1/integrations/notion/status`, `GET /api/v1/integrations/notion/search`, `POST /api/v1/integrations/notion/import`, `GET/PUT /api/v1/snapshot`

---

## Estrutura do Projeto

```text
├── server.ts                 # Entrada Express (porta 3000) + middleware Vite
├── server/                   # Rotas REST v1, Auth/RBAC, OpenAPI, Schemas Zod e Integrações
├── src/
│   ├── components/           # Componentes de Dados, Mapa, Fichas, Forja, Loot, Oráculo e Ajustes
│   ├── screens/              # Telas principais da aplicação
│   ├── store/                # Stores Zustand (App, Mapa, Loot, Oráculo)
│   ├── db/                   # Persistência IndexedDB, migrações, backup JSON e exportação ZIP
│   ├── lib/                  # Motores de rolagem, wiki-links, desenhos SVG, fichas e Forja
│   ├── data/                 # Tabelas JSON do Oráculo e regras de turno
│   └── types/                # Definições TypeScript compartilhadas
└── public/                   # Ícones e assets PWA
```
