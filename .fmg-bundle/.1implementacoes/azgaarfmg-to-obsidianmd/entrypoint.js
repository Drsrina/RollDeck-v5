import fs from "node:fs/promises";
import path from "node:path";
import { convertMapToObsidianVault } from "./dist/conversions.js";

const INPUT_DIR = process.env.INPUT_DIR || "/data/input";
const VAULT_DIR = process.env.VAULT_DIR || "/data/vault";
const WATCH_MODE = process.env.WATCH === "true";
const INTERVAL_MS = Number(process.env.WATCH_INTERVAL || 5000);

const processedMtimes = new Map();
let isConverting = false;

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
}

async function runConversion() {
  if (isConverting) return false;
  isConverting = true;

  try {
    await ensureDir(INPUT_DIR);
    await ensureDir(VAULT_DIR);

    const files = await fs.readdir(INPUT_DIR);
    const jsonFiles = files.filter(f => f.endsWith(".json"));

    if (jsonFiles.length === 0) {
      return false;
    }

    for (const jsonFile of jsonFiles) {
      const jsonPath = path.join(INPUT_DIR, jsonFile);
      const stat = await fs.stat(jsonPath);

      if (processedMtimes.get(jsonPath) === stat.mtimeMs) {
        continue;
      }

      const baseName = jsonFile.replace(/\.json$/, "");
      let mapPath = path.join(INPUT_DIR, `${baseName}.map`);
      let imgPath = path.join(INPUT_DIR, `${baseName}.svg`);

      try {
        await fs.stat(mapPath);
      } catch {
        console.log(`[obsidian-converter] Criando placeholder para ${baseName}.map`);
        await fs.writeFile(mapPath, "");
      }

      try {
        await fs.stat(imgPath);
      } catch {
        console.log(`[obsidian-converter] Criando placeholder para ${baseName}.svg`);
        await fs.writeFile(imgPath, "<svg></svg>");
      }

      console.log(`[obsidian-converter] Convertendo ${jsonFile} para o vault em ${VAULT_DIR}...`);
      try {
        await convertMapToObsidianVault(jsonPath, mapPath, imgPath, VAULT_DIR);
        processedMtimes.set(jsonPath, stat.mtimeMs);
        console.log(`[obsidian-converter] Sucesso! Notas Obsidian geradas para '${baseName}'.`);
      } catch (err) {
        console.error(`[obsidian-converter] Erro ao converter ${jsonFile}:`, err.message);
      }
    }
    return true;
  } finally {
    isConverting = false;
  }
}

async function main() {
  console.log("[obsidian-converter] Inicializando conversor FMG -> Obsidian...");
  await runConversion();

  if (WATCH_MODE) {
    console.log(`[obsidian-converter] Modo contínuo (watch) ativo. Monitorando alterações em ${INPUT_DIR}...`);
    setInterval(async () => {
      try {
        await runConversion();
      } catch (err) {
        console.error("[obsidian-converter] Erro no ciclo de verificação:", err);
      }
    }, INTERVAL_MS);
  }
}

main().catch(err => {
  console.error("[obsidian-converter] Falha fatal:", err);
  process.exit(1);
});
