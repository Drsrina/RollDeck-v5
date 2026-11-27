---
name: fmg-map-to-vault
description: >-
  Workflows and procedures for creating fantasy maps in Azgaar's Fantasy Map Generator (FMG),
  drawing maps from scratch via Heightmap Editor, exporting data, and automatically synchronizing
  structured Markdown notes with Obsidian and SilverBullet.
---

# Fantasy Map Generator -> Vault & Ecosystem Skill

This skill documents how to operate the unified local Docker stack for Azgaar's Fantasy Map Generator (FMG), including creating maps from scratch, procedural simulation, and automated conversion into Markdown notes for Obsidian and SilverBullet.

---

## 1. Unified Ecosystem Architecture

The local stack runs via `docker compose up -d` with five interconnected services:

| Service | Port | Description |
| :--- | :--- | :--- |
| **Fantasy Map Generator** | `http://localhost:8080` | Procedural map generator and editor (web app). |
| **Armoria** | `http://localhost:8081` | Procedural heraldry and coat of arms generator. |
| **Town Generator OS** | `http://localhost:8082` | Watabou medieval city & village generator. |
| **SilverBullet** | `http://localhost:8083` | In-browser Markdown PKM editor (`admin` / `admin123`). |
| **Obsidian Converter** | *Background container* | Watches `./dados_mapas` and writes to `./meu_obsidian_vault`. |

---

## 2. Drawing a Map Completely From Scratch (Heightmap Editor)

In FMG, maps can be generated procedurally or sculpted 100% manually from an empty ocean:

### Step-by-Step Procedure:
1. Open FMG at `http://localhost:8080`.
2. Go to **Tools** tab in the top menu and select **Heightmap** (or click *Edit Heightmap*).
3. When prompted, choose **Erase** mode:
   * *Erase mode* clears secondary layers (states, burgs, rivers) while allowing you to reshape coastlines and elevations completely.
4. **Clear the Canvas:**
   * Open the **Brushes** panel.
   * Click the **Eraser icon (`brushClear`)** — this sets all cell heights to `0`, transforming the entire world into an open ocean canvas.
5. **Sculpt Landmasses & Mountains:**
   * **Raise / Elevate (`brushRaise` / `brushElevate`):** Click or drag to pull islands and continents out of the sea (elevations >= 20 become land).
   * **Align (`brushAlign`):** Flatten plateaus or match specific elevations.
   * **Smooth (`brushSmooth`):** Soften rugged coastlines and smooth slopes.
   * **Disrupt (`brushDisrupt`):** Introduce fractal roughness and natural irregularities.
   * **Line (`brushLine`):** Draw continuous mountain ranges or ocean trenches.
6. **Alternative Generation Methods:**
   * **Template Editor:** Combine geometric primitives (`Hill`, `Pit`, `Range`, `Trough`, `Strait`, `Mask`) with custom seeds.
   * **Image Converter:** Load any grayscale or monochrome heightmap/sketch image to convert it into 3D topography.
7. **Bake & Simulate the World:**
   * Click **Exit Customization** (or *Complete*).
   * FMG executes `ErasePipeline`: it automatically calculates winds, rain shadows, rivers flowing downhill into oceans, lakes in deep depressions, realistic biomes, cultural distributions, towns at strategic river mouths/ports, and geopolitical borders!

---

## 3. Exporting Map Data to the Vault

To convert the newly designed world into Markdown notes:
1. In FMG, open the left side menu and click **Export**.
2. Download three files:
   * **GeoJSON / Data:** `map_name.json`
   * **Map Data:** `map_name.map`
   * **Vector Image:** `map_name.svg`
3. Place these files directly into the `./dados_mapas/` directory on the host.

---

## 4. Automatic Conversion & Note Generation

The `fmg-obsidian-converter` watcher immediately detects new or updated files:
* Generates structured folders in `./meu_obsidian_vault/1. World/`:
  * `States/`: Kingdom statistics, monarchies, cultures, total population.
  * `Burgs/`: Population, elevation, interactive Watabou city map `<iframe>`, and Armoria coat of arms SVG.
  * `Religions/`, `Cultures/`, `Provinces/`, `Routes/`, `Biomes/`.
* Preserves user customizations: any text written inside `%% CUSTOM-START %%` and `%% CUSTOM-END %%` tags remains intact across re-exports.

---

## 5. Browsing Notes in SilverBullet & Obsidian

* **SilverBullet (Browser):** Navigate to `http://localhost:8083`, login with `admin` / `admin123`.
  * Open `index.md` for quick bookmarks to kingdoms and cities.
  * Press `Ctrl+K` (or `Cmd+K`) to jump to any note or search across all generated files.
* **Obsidian (Desktop/Mobile):** Open `./meu_obsidian_vault` as an existing vault. Install the *Leaflet* plugin if interactive map pins are desired.
