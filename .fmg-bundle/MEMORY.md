# Memória de Ações e Implementações

Este documento registra todas as análises, adaptações, correções e implementações realizadas no repositório do **Azgaar's Fantasy Map Generator (FMG)** durante esta sessão.

---

## 1. Contexto e Visão Geral do Projeto
* **Projeto:** Azgaar's Fantasy Map Generator (FMG).
* **Finalidade:** Geração procedural, simulação política/cultural, edição e visualização de mapas de fantasia.
* **Stack Tecnológica:** TypeScript, SVG/WebGL, Vite, Biome, Vitest, Playwright, Electron.
* **Arquitetura (FMG 2.0):**
  * `State`: Dados do mundo (`grid` e `pack`).
  * `Model`: Geradores e simulações procedurais.
  * `Controllers`: Editores e ferramentas de mutação pelo usuário.
  * `Renderers`: Camadas SVG/WebGL sem estado e idempotentes.

---

## 2. Containerização Inicial do FMG
* **Diagnóstico do Dockerfile existente:**
  * O build do Vite (`vite.config.ts`) depende de `docs/updates` para o módulo virtual `virtual:latest-update`.
  * O script `npm run build` executa `tsc && vite build && node scripts/pwa-precache.mjs`, exigindo a pasta `scripts/`.
* **Ações realizadas:**
  * Criação do `.dockerignore` na raiz para ignorar `node_modules`, `dist`, `.git`, etc.
  * Atualização do `Dockerfile` da raiz para incluir `docs/`, `scripts/` e `tests/`.
  * Build inicial da imagem `fantasy-map-generator:latest` e execução bem-sucedida na porta `8080:80`.

---

## 3. Ecossistema e Integrações
* **Armoria:** Gerador e editor procedural de heráldica e brasões do próprio Azgaar (integrado via comunicação de mensagens postMessage e esquemas Zod).
* **Watabou:** Geradores procedurais de cidades, vilas e habitações (`city-generator`, `village-generator`, `dwellings`) embutidos via iframes no editor de povoados (*burgs*).
* **Obsidian:** Mapeamento de workflows para conversão de dados `.json`/`.map` em cofres Markdown estruturados com links bidirecionais e metadados YAML.

---

## 4. Criação do Bundle Docker Unificado Local (`docker-compose.yml`)
Foram incorporados e adaptados os três projetos disponibilizados na pasta `.1implementacoes/`:

### A. Armoria (`.1implementacoes/Armoria`)
* **Tecnologia:** SvelteKit + Vite.
* **Criação de arquivos:**
  * `.1implementacoes/Armoria/Dockerfile`: Imagem Node 24 rodando `vite dev --host 0.0.0.0 --port 5173`.
  * `.1implementacoes/Armoria/.dockerignore`.
* **Porta mapeada:** `8081:5173`.

### B. Conversor Obsidian (`.1implementacoes/azgaarfmg-to-obsidianmd`)
* **Tecnologia:** TypeScript/Node.js.
* **Criação de arquivos:**
  * `.1implementacoes/azgaarfmg-to-obsidianmd/Dockerfile`: Imagem Node 20 com compilação TypeScript (`npm run build`).
  * `.1implementacoes/azgaarfmg-to-obsidianmd/entrypoint.js`: Script Node inteligente que monitora o diretório de entrada (`/data/input`), gera placeholders para `.map`/`.svg` se faltarem, converte os `.json` encontrados e grava a estrutura de notas no vault (`/data/vault`).
  * `.1implementacoes/azgaarfmg-to-obsidianmd/.dockerignore`.
* **Volumes configurados:**
  * `./dados_mapas -> /data/input`
  * `./meu_obsidian_vault -> /data/vault`
* **Modo de operação:** `WATCH=true` (verifica periodicamente a cada 5 segundos).

### C. TownGeneratorOS (`.1implementacoes/TownGeneratorOS`)
* **Tecnologia:** Haxe / OpenFL / Lime (Watabou Medieval Fantasy City Generator).
* **Diagnóstico de falha inicial:**
  * As versões `openfl 8.9.0` e `lime 7.3.0` utilizam sintaxe legada `@:fakeEnum` incompatível com o Haxe 4+, além de exigir a biblioteca Neko compilada com glibc (falhava no Alpine musl).
* **Solução implementada:**
  * Imagem de compilação multi-stage baseada em `haxe:3.4` (Debian).
  * Execução de `openfl build html5`, gerando os arquivos estáticos compilados em `Export/html5/bin/`.
  * Segundo estágio em `nginx:alpine` servindo os arquivos estáticos na porta `80`.
* **Porta mapeada:** `8082:80`.

### D. Orquestração com Docker Compose
* **Arquivo:** `docker-compose.yml` na raiz.
* **Serviços orquestrados:**
  1. `fantasy-map-generator` (`:8080`)
  2. `armoria` (`:8081`)
  3. `town-generator` (`:8082`)
  4. `silverbullet` (`:8083`) - In-browser PKM Markdown editor conectado ao `./meu_obsidian_vault`
  5. `obsidian-converter` (background watcher)

### E. SilverBullet (Visualizador Web de Notas Markdown)
* **Tecnologia:** Rust backend + TypeScript/CodeMirror 6 frontend (SilverBullet).
* **Imagem utilizada:** `zefhemel/silverbullet:latest`.
* **Configuração:**
  * Provisionado automaticamente com `/silverbullet setup` para criar o espaço "Fantasy Notes" apontando para o volume `./meu_obsidian_vault:/space`.
  * Dados persistidos em `./silverbullet_data:/data`.
* **Porta:** `8083:3000`.
* **Acesso:** `http://localhost:8083` (Usuário: `admin` / Senha: `admin123`). Permite visualizar, navegar e editar as notas geradas pelo conversor diretamente no navegador, sem precisar instalar o app do Obsidian.

---

## 5. Correção da Prévia do Povoado (Burg Preview CSP)
* **Sintoma:** Ao clicar em um povoado no FMG, o quadro de prévia do mapa ficava vazio / bloqueado.
* **Causa Raiz:** O arquivo de configuração do Nginx (`.docker/default.conf`) impunha a diretiva:
  `Content-Security-Policy: default-src 'self';`
  Isso impedia o navegador de renderizar o `<iframe>` apontando para o gerador de cidades/vilas do Watabou ou para portas locais.
* **Correção aplicada em `.docker/default.conf`:**
  * Atualização da CSP para:
    `default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; frame-src 'self' https: http://localhost:* http://127.0.0.1:*; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; img-src 'self' data: blob: https:; font-src 'self' data: https:;`
  * Alteração de `X-Frame-Options` de `DENY` para `SAMEORIGIN`.

---

## 6. Estrutura de Diretórios e Documentação Criada
* **`dados_mapas/`**: Pasta de entrada com instruções (`README.md`) para o usuário salvar os arquivos `.json`, `.map` e `.svg`.
* **`meu_obsidian_vault/`**: Pasta de saída pronta para ser aberta diretamente no aplicativo Obsidian ou visualizada pelo SilverBullet.
* **`docs/local-docker-bundle.md`**: Guia completo de arquitetura, portas, comandos Docker e instruções de fluxo com o Obsidian e SilverBullet.
* **`README.md`**: Atualizado com link direto e comando rápido para a stack Docker unificada.

---

## 7. Primeiro Teste Executado com Sucesso (FMG -> Markdown -> SilverBullet)
* **Mapa de Teste:** Dados do mapa de referência `koberzar` (`.json`, `.map`, `.svg`) colocados em `./dados_mapas/`.
* **Processamento:** O contêiner `fmg-obsidian-converter` detectou os arquivos e processou as entidades geopolíticas, demográficas e geográficas.
* **Resultado:**
  * **1.479 notas Markdown geradas** em `./meu_obsidian_vault/1. World/` (organizadas em `States/`, `Burgs/`, `Cultures/`, `Religions/`, `Provinces/`, `Routes/`, `Biomes/`).
  * Cada nota contém metadados YAML (população, cultura, religião, coordenadas, tags), brasões embutidos via Armoria, visualização de cidades em `<iframe>` do Watabou, e links bidirecionais no formato `[[...]]`.
  * Criação de um `index.md` como hub central no SilverBullet com links para os principais reinos e capitais.
  * Acesso validado no SilverBullet em `http://localhost:8083` (autenticação com `admin:admin123`).

---

## 8. Criação da Skill do Ecossistema e Desenho de Mapas do Zero
* **Skill Registrada no Repositório:** Criado o arquivo `.agents/skills/fmg-map-to-vault/SKILL.md` documentando o fluxo completo de orquestração do ecossistema, exportação de mapas, conversão em Markdown e acesso via Obsidian/SilverBullet.
* **Desenho do Zero no FMG:** Validado o fluxo nativo através do **Heightmap Editor**:
  * Modo **Erase** -> Ferramenta de pincéis (`Brushes`) -> Botão borracha (`brushClear`) para zerar todas as células em altitude 0 (oceano aberto).
  * Pincéis `Raise`, `Elevate`, `Align`, `Smooth`, `Line`, além de `Template Editor` e conversão de imagens de relevo (`Image Converter`).
  * Ao finalizar (`Exit Customization`), a `ErasePipeline` regenera automaticamente clima, ventos, bacias hidrográficas, biomas, culturas e reinos políticos sobre o relevo esculpido.

---

## 9. Mapa de Portas e Comandos de Operação

| Serviço | URL |
| :--- | :--- |
| **Fantasy Map Generator** | `http://localhost:8080` |
| **Armoria (Heráldica)** | `http://localhost:8081` |
| **Town Generator (Cidades)** | `http://localhost:8082` |
| **SilverBullet (Notas Web)** | `http://localhost:8083` |
| **Obsidian Converter** | *Monitorando `./dados_mapas`* |

### Comandos Principais:
```bash
# Iniciar todos os serviços reconstruindo imagens
docker compose up -d --build

# Ver status dos contêineres
docker compose ps

# Ver logs de um serviço específico
docker compose logs -f obsidian-converter

# Parar todos os serviços
docker compose stop
```
