# RollDeck v5 — Estúdio TTRPG Offline-First & Suíte Cartográfica Unificada

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-brightgreen.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-blue.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-purple.svg)](https://vitejs.dev)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com)
[![PWA](https://img.shields.io/badge/PWA-100%25%20Offline-orange.svg)](https://web.dev/progressive-web-apps/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

O **RollDeck v5** é uma suíte completa e modular para mestres e jogadores de RPG de mesa (TTRPG). Projetado com foco *mobile-first*, arquitetura *offline-first* via **IndexedDB + PWA** e servidor **Express/TypeScript** com controle de acesso RBAC, chave de API externa (`rdk_...`) e REST API documentada em OpenAPI 3.1.

Na versão 5.0, o RollDeck integra nativamente o ecossistema **`.fmg-bundle`**, transformando-se em um **Estúdio de Criação Unificado** para cidades, brasões heráldicos, mapas continentais e notas Markdown integradas por `[[Wiki-links]]`.

---

## 🏛️ Arquitetura Unificada de Containers (Docker)

O RollDeck orquestra **6 serviços independentes e interoperáveis** através do [`docker-compose.yml`](file:///e:/Code/RollDeck-v5/docker-compose.yml):

```
                       ┌───────────────────────────────┐
                       │     RollDeck v5 Principal     │
                       │     http://localhost:3000     │
                       │ (VTT, Forja, Canvas, Oráculo) │
                       └──────────────┬────────────────┘
                                      │
       ┌──────────────────────────────┼──────────────────────────────┐
       │                              │                              │
┌──────▼──────────────┐   ┌───────────▼─────────────┐   ┌────────────▼────────────┐
│ Azgaar FMG (Mundos) │   │    Armoria (Heráldica)  │   │  Watabou City Generator │
│http://localhost:8080│   │  http://localhost:8081  │   │  http://localhost:8082  │
└─────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
       │                                                             │
       │ (.json / .svg)                                              │ (plantas baixas)
       ▼                                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│           Pipeline FMG ➔ Obsidian ➔ RollDeck ([[Wiki-links]])           │
│      SilverBullet Notes (http://localhost:8083) | Vault Compartilhado    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Mapa de Serviços & Portas

| Serviço | Porta Local | Container | Função |
|---|---|---|---|
| **RollDeck v5** | `http://localhost:3000` | `rolldeck-app` | Aplicação central, VTT, Canvas, Forja, API REST v1 e PWA |
| **Fantasy Map Generator** | `http://localhost:8080` | `fantasy-map-generator` | Simulação cartográfica de continentes, relevo 3D e biomas |
| **Armoria Heráldica** | `http://localhost:8081` | `armoria-heraldry` | Criação vetorial de brasões para facções, ordens e fichas |
| **Town Generator** | `http://localhost:8082` | `town-generator` | Geração procedural de plantas baixas urbanas medievais |
| **SilverBullet Notes** | `http://localhost:8083` | `silverbullet-notes` | Visualizador e editor de notas Markdown do Vault |
| **FMG ➔ Obsidian** | *Daemon interno* | `fmg-obsidian-converter` | Sincronizador de arquivos `.json` do FMG em notas Markdown |

---

## 🎲 Módulos Principais do RollDeck

### 1. Estúdio de Criação Integrado (`StudioScreen`)
- **Watabou Medieval Fantasy City Generator:** Servido de forma nativa e estática em `/apps/city-generator`, permitindo gerar cidades, muralhas e castelos com download em PNG/SVG.
- **Armoria Heráldica & Brasões:** Criação de escudos com alternador de fonte (🌐 Nuvem Oficial Vercel ou 💻 Container Docker Local :8081).
- **Cofre de Heráldica:** Banco de dados de brasões no RollDeck com sanitização de segurança anti-XSS ([svgSanitizer.ts](file:///e:/Code/RollDeck-v5/src/lib/svgSanitizer.ts)), vinculação direta aos cards de facções da Forja e fichas de personagens.
- **Azgaar's Fantasy Map Generator (FMG):** Geração continental com envio com 1 clique para o VTT (como fundo de cena) e para o Canvas do MapScreen.
- **SilverBullet Notes:** Acesso direto ao editor de notas Markdown conectado ao vault de campanha na porta 8083.
- **Pipeline FMG ➔ Wiki-links:** Upload de arquivos `.json` do FMG para gerar automaticamente redes de nós de Reinos, Cidades e Culturas com conexões visuais `[[Wiki-links]]`.
- **Exportador Obsidian Vault:** Exportação das notas do RollDeck em Markdown consolidado com frontmatter YAML ([obsidianExporter.ts](file:///e:/Code/RollDeck-v5/src/lib/obsidianExporter.ts)).

### 2. Mapa Mental & Cartografia Interativa (`MapScreen`)
- **Canvas infinito a 60fps** com zoom/pan suave, simulação de gravidade/física (`d3-force`), Snap-to-Grid (`20px`) e Modo Foco de Vizinhança.
- **Conexões & [[Wiki-links]]:** Suporte completo à sintaxe `[[Nome da Nota]]` e `[[Nota|Rótulo]]` com sincronização automática de arestas visuais.
- **Fichas de Personagem no Canvas:** Atributos D&D 5e/5.5 com rolagens ao clicar, controle de PV/PV temporário, CA, iniciativa, ataques e inventário.
- **Desenho Vetorial SVG:** Caneta cartográfica (Livre, Rio, Trilha, Parede), gizmo de transformação, camadas e histórico de Undo/Redo.
- **Janelas Flutuantes:** Desacople qualquer nota ou ficha para uma janela flutuante arrastável que persiste entre telas.

### 3. Virtual Tabletop Tático (`VttScreen`)
- Tabuleiro tático com suporte a grids Quadrado e Hexagonal.
- Envio instantâneo de mapas do FMG e Forja como imagem de fundo de alta resolução.
- Gerenciamento de combate, iniciativa, condições de status e efeitos climáticos dinâmicos (chuva, neve, névoa, brasas, relâmpago).
- Rolador 3D transparente flutuante integrado ao grid.

### 4. Forja de Mundos Procedural (`ForjaScreen`)
- Arquitetura modularizada em 9 abas de domínio:
  - **Mundo:** Síntese continental, placas tectônicas e atalho direto para o Estúdio FMG.
  - **Assentamento:** Aldeias, vilas e cidades com distritos, POIs e facções integradas aos brasões do Armoria.
  - **Terreno:** Malhas poligonais de Voronoi e bacias hidrográficas.
  - **Masmorra:** Donjon, salas BSP e labirintos celulares.
  - **NPCs:** Nomes gerados por cadeias de Markov, motivações, segredos e traços de personalidade.
  - **Itens & Tesouros:** Armas, relíquias e tabelas de saque.
  - **Markov:** Treinamento procedural de nomes por culturas.
  - **Fantasia:** Níveis de magia e ganchos cósmicos.
  - **Sessão ao Vivo:** Gerador de encontros D&D 5.5 (2024) com envio direto para o VTT.

### 5. Rolador de Dados & Pacotes (`RollScreen`)
- Suporte a dados poliédricos padrão (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`) e dados customizados.
- Dados 3D realistas renderizados via Three.js.
- Pacotes salvos, vantagens/desvantagens, keep highest/lowest e rerrolagem de 1s.
- Atalhos de teclado globais (`1` a `9` para alternar telas, `Ctrl+Z` para desfazer).

### 6. Oráculo de Campanha & Gestão de Turnos (`OraculoScreen`)
- Oráculo Sim/Não com probabilidades ajustáveis e eventos inesperados.
- Tabelas determinísticas de clima, rumores, complicações de viagem e encontros sazonais.

---

## 🚀 Como Iniciar

### Opção A: Execução Unificada via Docker (Recomendada)
Para rodar toda a suíte (RollDeck + FMG + Armoria + Watabou + SilverBullet):

```bash
# 1. Iniciar todos os serviços em segundo plano
npm run docker:up
# ou: docker compose up -d

# 2. Acessar no navegador:
# RollDeck:      http://localhost:3000
# Azgaar FMG:    http://localhost:8080
# Armoria:       http://localhost:8081
# TownGen:       http://localhost:8082
# SilverBullet:  http://localhost:8083

# 3. Acompanhar os logs
npm run docker:logs

# 4. Parar todos os serviços
npm run docker:down
```

### Opção B: Execução Local em Desenvolvimento (Node.js)
Caso prefira rodar apenas o RollDeck diretamente na sua máquina:

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar o servidor em desenvolvimento (Express + Vite)
npm run dev

# 3. Acessar em http://localhost:3000
```

---

## 📜 Scripts do `package.json`

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia servidor Express + Vite em desenvolvimento (`http://localhost:3000`) |
| `npm run build` | Compila o frontend React em `dist/` com PWA Service Worker |
| `npm run start` | Inicia o servidor em produção (`tsx server.ts`) |
| `npm run lint` | Checagem de tipos TypeScript rigorosa (`tsc --noEmit`) |
| `npm run test` | Executa a suíte de 101 testes automatizados com Vitest (`vitest run`) |
| `npm run docker:up` | Sobe todos os 6 containers da suíte em segundo plano |
| `npm run docker:down` | Encerra os containers do Docker Compose |
| `npm run docker:build`| Reconstrói as imagens dos containers |
| `npm run docker:logs` | Monitora logs em tempo real dos containers |

---

## 🔐 Autenticação, RBAC & REST API v1

O RollDeck possui autenticação local via hash Scrypt, sessões por token Bearer e controle de acesso baseado em papéis:
- **`admin`**: Acesso irrestrito a configurações, gerenciamento de usuários e chaves externas.
- **`gm`**: Controle completo de notas, VTT, fichas, Forja, Oráculo e Estúdio.
- **`player`**: Acesso restrito às suas próprias fichas e ao rolador de dados.
- **`viewer`**: Acesso somente-leitura.

### Documentação da API
- **Especificação OpenAPI 3.1:** `GET /api/openapi.json`
- **Healthcheck:** `GET /api/health`
- **Chaves de API:** Podem ser geradas em **Ajustes → API & Integrações** com prefixo `rdk_...` e passadas via cabeçalho `X-API-Key: rdk_...`.

---

## 🧪 Qualidade de Código & Testes

O projeto conta com testes unitários e de integração abrangentes:
- **17 arquivos de teste e 106 testes automatizados** passando com 100% de sucesso.
- **Zero erros no linting** (`tsc --noEmit`).
- **Isolamento de dependências:** O bundle `.fmg-bundle` é excluído dos testes do RollDeck, evitando conflitos de módulos.

---

## 📄 Licença
Distribuído sob a licença **GNU General Public License v3.0 (GPL-3.0)**. Veja [`LICENSE`](file:///e:/Code/RollDeck-v5/LICENSE) para o texto completo.

> **Créditos e Componentes Integrados:**
> - **Azgaar's Fantasy Map Generator** & **Armoria** (Max Haniyeu / Azgaar — MIT)
> - **AzgaarFMG-to-ObsidianMD** (znewton — GPL-3.0)
> - **SilverBullet** (Zef Hemel — MIT)
> - **Medieval Fantasy City Generator / TownGeneratorOS** (Watabou)
