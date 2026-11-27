# Local Docker Bundle (FMG + Armoria + TownGenerator + Obsidian)

Este repositório possui uma stack unificada em Docker Compose para rodar localmente todo o ecossistema de geração de mapas, edição de heráldica, gerador de cidades e conversão automática para notas no **Obsidian**.

---

## 🚀 Serviços Inclusos

| Serviço | Descrição | Endereço Local |
| :--- | :--- | :--- |
| **`fantasy-map-generator`** | O gerador e editor de mapas de fantasia principal | [http://localhost:8080](http://localhost:8080) |
| **`armoria`** | Gerador e editor procedural de brasões e heráldica (*Coats of Arms*) | [http://localhost:8081](http://localhost:8081) |
| **`town-generator`** | Gerador de mapas urbanos medievais (Watabou) | [http://localhost:8082](http://localhost:8082) |
| **`silverbullet`** | Visualizador e editor de notas Markdown (Obsidian) no navegador | [http://localhost:8083](http://localhost:8083) |
| **`obsidian-converter`** | Serviço em background que monitora mapas e gera notas Markdown | *(Volume em background)* |

---

## 📂 Estrutura de Pastas e Volumes

* **`dados_mapas/`**: Pasta de entrada. Salve aqui os arquivos exportados pelo FMG (`<nome>.json`, `<nome>.map`, `<nome>.svg`).
* **`meu_obsidian_vault/`**: Pasta de saída configurada como um **Cofre do Obsidian**. As notas Markdown são criadas automaticamente aqui.

---

## 🛠️ Como Iniciar

1. Garanta que o **Docker Desktop** esteja aberto e rodando no seu computador.
2. No terminal, execute:
   ```bash
   docker compose up -d --build
   ```
3. Acesse os serviços no navegador:
   * **Mapa:** [http://localhost:8080](http://localhost:8080)
   * **Brasões (Armoria):** [http://localhost:8081](http://localhost:8081)
   * **Cidades (TownGenerator):** [http://localhost:8082](http://localhost:8082)
   * **Notas Web (SilverBullet):** [http://localhost:8083](http://localhost:8083) *(Login: `admin` / `admin123`)*

---

## 📝 Fluxo de Trabalho com o Obsidian

1. No Fantasy Map Generator ([http://localhost:8080](http://localhost:8080)), gere e personalize seu mapa.
2. Na aba **Save / Export**, salve os arquivos do seu mapa dentro da pasta local `dados_mapas/`:
   * Exporte como **`.json`** (*Save -> Machine-readable / JSON*).
   * *(Opcional, mas recomendado)* Salve também como **`.map`** e **`.svg`**.
3. O contêiner `obsidian-converter` detectará automaticamente o novo arquivo e criará toda a estrutura de notas (`States`, `Burgs`, `Religions`, `Cultures`, `Assets`) na pasta `meu_obsidian_vault/`.
4. Abra o **Obsidian**, selecione **"Open folder as vault"** e aponte para a pasta `meu_obsidian_vault/`.

---

## 🎨 Como Desenhar um Mapa do Zero (Heightmap Editor)

O FMG permite tanto gerar mapas aleatórios quanto esculpir a geografia 100% manualmente a partir do oceano vazio:

1. Acesse o FMG em [http://localhost:8080](http://localhost:8080).
2. Na aba superior **Tools**, clique em **Heightmap** (Editor de Altitudes).
3. Na janela que abrir, selecione o modo **Erase** (este modo limpa entidades secundárias e permite redesenhar as linhas de costa).
4. Abra o painel **Brushes** e clique no ícone da **Borracha (`brushClear`)**: isso zera a elevação de todas as células para `0`, transformando todo o mapa em um oceano vazio.
5. Use os pincéis para esculpir o mundo:
   * **Raise / Elevate:** Puxe ilhas, continentes e elevações para fora do mar (valores >= 20 tornam-se terra).
   * **Align / Smooth:** Crie planaltos ou suavize encostas e litorais.
   * **Line:** Desenhe cadeias de montanhas contínuas ou fossas oceânicas.
   * **Template Editor / Convert Image:** Você também pode carregar qualquer imagem monocromática de relevo ou usar modelos geométricos.
6. Ao terminar, clique em **Exit Customization**: o FMG roda a simulação física automaticamente — calculando ventos, chuvas, rios que descem até o mar, lagos, biomas, culturas, cidades portuárias estratégicas e reinos sobre o terreno que você desenhou!

---

## 🛑 Comandos Úteis

* **Ver os logs de todos os serviços:**
  ```bash
  docker compose logs -f
  ```
* **Ver os logs do conversor para Obsidian:**
  ```bash
  docker compose logs -f obsidian-converter
  ```
* **Parar a stack:**
  ```bash
  docker compose stop
  ```
* **Remover os contêineres:**
  ```bash
  docker compose down
  ```
