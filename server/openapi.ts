export function buildOpenApiSpec(baseUrl: string) {
  const crudPaths = (resource: string, tag: string, singular: string) => ({
    [`/api/v1/${resource}`]: {
      get: {
        tags: [tag],
        summary: `Listar ${resource}`,
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } },
        ],
        responses: {
          '200': { description: `Lista de ${resource} com metadados de paginação` },
          '401': { description: 'Não autenticado' },
        },
      },
      post: {
        tags: [tag],
        summary: `Criar ${singular}`,
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        responses: {
          '201': { description: `${singular} criado com sucesso` },
          '400': { description: 'Payload inválido (erro de schema Zod)' },
          '401': { description: 'Não autenticado' },
          '403': { description: 'Chave sem permissão write' },
        },
      },
    },
    [`/api/v1/${resource}/{id}`]: {
      get: {
        tags: [tag],
        summary: `Obter ${singular} por ID`,
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: `${singular} encontrado` },
          '404': { description: 'Registro não encontrado' },
        },
      },
      put: {
        tags: [tag],
        summary: `Substituir ${singular} por ID`,
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: `${singular} atualizado` },
          '404': { description: 'Registro não encontrado' },
        },
      },
      patch: {
        tags: [tag],
        summary: `Atualizar parcialmente ${singular}`,
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: `${singular} atualizado` },
          '404': { description: 'Registro não encontrado' },
        },
      },
      delete: {
        tags: [tag],
        summary: `Remover ${singular}`,
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: `${singular} removido` },
          '404': { description: 'Registro não encontrado' },
        },
      },
    },
  });

  return {
    openapi: '3.1.0',
    info: {
      title: 'RollDeck — API REST Local & Integrações Externas',
      version: '1.0.0',
      description:
        'API REST completa para automações, bots de Discord, VTTs e scripts externos. Inclui CRUD completo das coleções do RollDeck, rolagem de dados com notação RPG, Oráculo determinístico, Forja de Mundos e sincronização local com o navegador.',
    },
    servers: [{ url: baseUrl, description: 'Instância local / atual do RollDeck' }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Chave externa no formato rdk_... gerada em Ajustes → API & Integrações.',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Token de sessão de mestre (rds_...) ou chave de API (rdk_...).',
        },
      },
    },
    paths: {
      '/api/health': {
        get: {
          tags: ['Sistema'],
          summary: 'Status do servidor e estatísticas da API',
          responses: { '200': { description: 'Servidor operacional' } },
        },
      },
      '/api/v1': {
        get: {
          tags: ['Sistema'],
          summary: 'Índice de recursos e endpoints disponíveis',
          responses: { '200': { description: 'Catálogo da API v1' } },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Autenticação'],
          summary: 'Login simples com usuário e senha (sem e-mail)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: { username: 'admin', password: 'minha-senha-segura' },
              },
            },
          },
          responses: {
            '200': { description: 'Retorna sessionToken Bearer e dados públicos do usuário' },
            '401': { description: 'Credenciais inválidas' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Autenticação'],
          summary: 'Retorna usuário autenticado, papel e permissões ativas',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Dados públicos do usuário logado' } },
        },
      },
      '/api/v1/users': {
        get: {
          tags: ['Usuários (Admin)'],
          summary: 'Listar todos os usuários (somente admin)',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Lista de contas e níveis de permissão' } },
        },
        post: {
          tags: ['Usuários (Admin)'],
          summary: 'Criar novo usuário sem e-mail com papel (admin, gm, player, viewer)',
          security: [{ BearerAuth: [] }],
          responses: {
            '201': { description: 'Usuário criado' },
            '409': { description: 'Nome de usuário já existe' },
          },
        },
      },
      '/api/v1/users/{id}': {
        patch: {
          tags: ['Usuários (Admin)'],
          summary: 'Alterar papel, nome, status ativo ou redefinir senha (somente admin)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Usuário atualizado' } },
        },
        delete: {
          tags: ['Usuários (Admin)'],
          summary: 'Remover usuário (somente admin)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Usuário removido' } },
        },
      },
      '/api/v1/keys': {
        get: {
          tags: ['Chaves de API'],
          summary: 'Listar chaves externas (somente sessão de mestre)',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Metadados das chaves' } },
        },
        post: {
          tags: ['Chaves de API'],
          summary: 'Criar nova chave externa com escopos (retorna o segredo uma única vez)',
          security: [{ BearerAuth: [] }],
          responses: { '201': { description: 'Chave criada com sucesso' } },
        },
      },
      '/api/v1/keys/{id}': {
        delete: {
          tags: ['Chaves de API'],
          summary: 'Revogar uma chave externa',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Chave revogada' } },
        },
      },
      '/api/v1/roll': {
        post: {
          tags: ['Motores RPG'],
          summary: 'Rolar dados por notação RPG (ex: "2d20kh1+5", "4d6kh3"), grupos ou packageId',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  title: 'Ataque com Vantagem',
                  expression: '2d20kh1+5 + 1d8+3',
                  saveToHistory: true,
                },
              },
            },
          },
          responses: { '200': { description: 'Resultado detalhado da rolagem' } },
        },
      },
      '/api/v1/oracle': {
        post: {
          tags: ['Motores RPG'],
          summary: 'Consultar Oráculo dos Terratenentes (com suporte a seed determinística)',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  pergunta: 'O taverneiro sabe sobre a passagem secreta?',
                  probabilidade: 'provavel',
                  modificador: 5,
                },
              },
            },
          },
          responses: { '200': { description: 'Veredito do oráculo e eventual evento duplo' } },
        },
      },
      '/api/v1/forja/world': {
        post: {
          tags: ['Motores RPG'],
          summary: 'Gerar mundo completo determinístico pela Forja de Mundos',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          requestBody: {
            content: { 'application/json': { example: { seed: 42 } } },
          },
          responses: { '200': { description: 'Terreno, assentamento, masmorra, NPCs, itens e rumores' } },
        },
      },
      '/api/v1/forja/npcs': {
        post: {
          tags: ['Motores RPG'],
          summary: 'Gerar lote de NPCs determinísticos',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: { '200': { description: 'Lista de NPCs gerados' } },
        },
      },
      '/api/v1/forja/items': {
        post: {
          tags: ['Motores RPG'],
          summary: 'Gerar lote de itens e tesouros determinísticos',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: { '200': { description: 'Lista de itens gerados' } },
        },
      },
      '/api/v1/forja/dungeon': {
        post: {
          tags: ['Motores RPG'],
          summary: 'Gerar masmorra determinística (Donjon, BSP ou Caverna)',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: { '200': { description: 'Estrutura completa da masmorra e grafo de missão' } },
        },
      },
      '/api/v1/forja/settlement': {
        post: {
          tags: ['Motores RPG'],
          summary: 'Gerar assentamento determinístico (aldeia, vila ou cidade)',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: { '200': { description: 'Distritos, POIs, facções e demografia' } },
        },
      },
      '/api/v1/integrations/obsidian/import': {
        post: {
          tags: ['Integrações Externas'],
          summary: 'Importar notas Markdown do Obsidian com frontmatter YAML, #tags e [[wiki-links]]',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: {
            '201': { description: 'Notas importadas e conexões criadas automaticamente' },
            '400': { description: 'Payload inválido' },
            '403': { description: 'Requer permissão write' },
          },
        },
      },
      '/api/v1/integrations/notion/status': {
        get: {
          tags: ['Integrações Externas'],
          summary: 'Verificar se o token NOTION_API_KEY está configurado no servidor',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: { '200': { description: 'Status da configuração do Notion no servidor' } },
        },
      },
      '/api/v1/integrations/notion/search': {
        get: {
          tags: ['Integrações Externas'],
          summary: 'Pesquisar páginas e databases compartilhados com a integração Notion',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['page', 'database'] } },
          ],
          responses: {
            '200': { description: 'Lista de páginas e databases do Notion' },
            '503': { description: 'NOTION_API_KEY não configurada no servidor' },
          },
        },
      },
      '/api/v1/integrations/notion/import': {
        post: {
          tags: ['Integrações Externas'],
          summary: 'Importar páginas ou database do Notion convertendo blocos e menções em notas e links',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: {
            '201': { description: 'Páginas importadas do Notion com links automáticos' },
            '503': { description: 'NOTION_API_KEY não configurada no servidor' },
          },
        },
      },
      '/api/v1/snapshot': {
        get: {
          tags: ['Sincronização Local'],
          summary: 'Exportar snapshot completo do repositório local da API',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: { '200': { description: 'Dataset completo em formato BackupData' } },
        },
        put: {
          tags: ['Sincronização Local'],
          summary: 'Sincronizar snapshot do navegador para a API (replace ou merge)',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: { '200': { description: 'Snapshot sincronizado com contagens atualizadas' } },
        },
      },
      '/api/v1/settings': {
        get: {
          tags: ['Configurações'],
          summary: 'Obter preferências salvas na API',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: { '200': { description: 'Objeto AppSettings' } },
        },
        patch: {
          tags: ['Configurações'],
          summary: 'Atualizar preferências',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: { '200': { description: 'Objeto AppSettings atualizado' } },
        },
      },
      '/api/v1/view-state': {
        get: {
          tags: ['Mapa'],
          summary: 'Obter estado da câmera/visão do mapa',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: { '200': { description: 'Objeto MapViewState' } },
        },
        patch: {
          tags: ['Mapa'],
          summary: 'Atualizar estado da câmera/visão do mapa',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: { '200': { description: 'Objeto MapViewState atualizado' } },
        },
      },
      ...crudPaths('notes', 'Mapa', 'nota'),
      ...crudPaths('links', 'Mapa', 'conexão'),
      ...crudPaths('layers', 'Mapa', 'camada'),
      ...crudPaths('frames', 'Mapa', 'moldura de região'),
      ...crudPaths('drawings', 'Mapa', 'desenho SVG'),
      ...crudPaths('dice', 'Dados & Pacotes', 'dado customizado'),
      ...crudPaths('packages', 'Dados & Pacotes', 'pacote de rolagem'),
      ...crudPaths('categories', 'Dados & Pacotes', 'categoria'),
      ...crudPaths('history', 'Dados & Pacotes', 'registro de histórico'),
      ...crudPaths('loot-generators', 'Loot', 'gerador de loot'),
      ...crudPaths('loot-groups', 'Loot', 'grupo de loot'),
    },
  };
}
