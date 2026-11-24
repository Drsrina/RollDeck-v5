/**
 * FORJA DE MUNDOS — Weaver de Entidades e Grafo de Relações (§4)
 *
 * Provê IDs únicos estáveis, modelo de dados tipado e grafo consultável
 * de relações unidirecionais e simétricas entre Terreno, Assentamento, Masmorra,
 * Facções, NPCs, Itens e Rumores.
 */

export type EntityType =
  | 'npc'
  | 'location'
  | 'settlement'
  | 'dungeon'
  | 'dungeon_room'
  | 'faction'
  | 'item'
  | 'rumor'
  | 'cell'
  | 'river'
  | 'route'
  | 'quest';

export type RelationType =
  | 'located_at'
  | 'member_of'
  | 'leader_of'
  | 'owned_by'
  | 'contains'
  | 'rival_of'
  | 'allied_with'
  | 'references'
  | 'on_terrain'
  | 'connects'
  | 'flows_through'
  | 'originates_from'
  | 'guards'
  | 'threatens';

export interface ForjaEntity {
  id: string;
  type: EntityType;
  name: string;
  description: string;
  tags: string[];
  data: Record<string, any>;
  createdAtSeed: number;
}

export interface ForjaRelation {
  id: string;
  fromId: string;
  toId: string;
  type: RelationType;
  isSymmetric?: boolean;
  metadata?: Record<string, any>;
}

export class EntityWeaver {
  private entities: Map<string, ForjaEntity> = new Map();
  private relations: ForjaRelation[] = [];
  private fromIndex: Map<string, ForjaRelation[]> = new Map();
  private toIndex: Map<string, ForjaRelation[]> = new Map();
  private counterByType: Map<string, number> = new Map();

  /**
   * Gera um ID estável e único para uma entidade (§4.1)
   * ex: npc_001, loc_017, faccao_003
   */
  public generateId(type: EntityType): string {
    const current = (this.counterByType.get(type) || 0) + 1;
    this.counterByType.set(type, current);
    const padded = current.toString().padStart(3, '0');
    return `${type}_${padded}`;
  }

  /**
   * Adiciona ou atualiza uma entidade no grafo
   */
  public addEntity(entity: ForjaEntity): ForjaEntity {
    this.entities.set(entity.id, entity);
    return entity;
  }

  public getEntity(id: string): ForjaEntity | undefined {
    return this.entities.get(id);
  }

  public hasEntity(id: string): boolean {
    return this.entities.has(id);
  }

  public getAllEntities(): ForjaEntity[] {
    return Array.from(this.entities.values());
  }

  public getEntitiesByType(type: EntityType): ForjaEntity[] {
    const res: ForjaEntity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.type === type) res.push(entity);
    }
    return res;
  }

  /**
   * Conecta duas entidades através de uma relação tipada (§4.2)
   */
  public addRelation(
    fromId: string,
    toId: string,
    type: RelationType,
    isSymmetric = false,
    metadata?: Record<string, any>
  ): ForjaRelation {
    const id = `rel_${fromId}_${type}_${toId}`;
    const rel: ForjaRelation = { id, fromId, toId, type, isSymmetric, metadata };
    this.relations.push(rel);

    // Indexa de -> para
    if (!this.fromIndex.has(fromId)) this.fromIndex.set(fromId, []);
    this.fromIndex.get(fromId)!.push(rel);

    // Indexa para <- de
    if (!this.toIndex.has(toId)) this.toIndex.set(toId, []);
    this.toIndex.get(toId)!.push(rel);

    // Se simétrica, indexa também o caminho reverso
    if (isSymmetric) {
      if (!this.fromIndex.has(toId)) this.fromIndex.set(toId, []);
      this.fromIndex.get(toId)!.push(rel);

      if (!this.toIndex.has(fromId)) this.toIndex.set(fromId, []);
      this.toIndex.get(fromId)!.push(rel);
    }

    return rel;
  }

  /**
   * Retorna relações originadas nesta entidade
   */
  public getRelationsFrom(entityId: string, filterType?: RelationType): ForjaRelation[] {
    const list = this.fromIndex.get(entityId) || [];
    if (!filterType) return list;
    return list.filter((r) => r.type === filterType);
  }

  /**
   * Retorna relações que apontam para esta entidade
   */
  public getRelationsTo(entityId: string, filterType?: RelationType): ForjaRelation[] {
    const list = this.toIndex.get(entityId) || [];
    if (!filterType) return list;
    return list.filter((r) => r.type === filterType);
  }

  /**
   * Consulta rumores que referenciam uma dada entidade (§4.2)
   */
  public getRumorsReferencing(entityId: string): ForjaEntity[] {
    const rels = this.getRelationsTo(entityId, 'references');
    const results: ForjaEntity[] = [];
    for (const rel of rels) {
      const ent = this.getEntity(rel.fromId);
      if (ent && ent.type === 'rumor') results.push(ent);
    }
    return results;
  }

  /**
   * Retorna entidades vizinhas diretas conectadas por qualquer relação
   */
  public getNeighbors(entityId: string): ForjaEntity[] {
    const neighborIds = new Set<string>();
    for (const r of this.fromIndex.get(entityId) || []) {
      neighborIds.add(r.fromId === entityId ? r.toId : r.fromId);
    }
    for (const r of this.toIndex.get(entityId) || []) {
      neighborIds.add(r.fromId === entityId ? r.toId : r.fromId);
    }

    const res: ForjaEntity[] = [];
    for (const nid of neighborIds) {
      const ent = this.getEntity(nid);
      if (ent) res.push(ent);
    }
    return res;
  }

  /**
   * Exporta todo o grafo em formato serializável JSON (§10.2)
   */
  public exportJSON(): {
    entities: ForjaEntity[];
    relations: ForjaRelation[];
  } {
    return {
      entities: this.getAllEntities(),
      relations: [...this.relations],
    };
  }

  /**
   * Limpa o grafo
   */
  public clear(): void {
    this.entities.clear();
    this.relations = [];
    this.fromIndex.clear();
    this.toIndex.clear();
    this.counterByType.clear();
  }
}
