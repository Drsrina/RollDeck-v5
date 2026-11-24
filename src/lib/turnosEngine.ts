import { REGRAS_TURNOS, TODAS_TABELAS } from '../data';
import type { CidadeEstado, EstacaoAno, LogEntry, RelatorioTurno, RecursosCidade } from '../types/oraculo';
import { consultarTabela, roll1d100 } from './prng';

/**
 * Determina a estação do ano baseada no dia decorrido da campanha.
 */
export function calcularEstacao(dia: number): EstacaoAno {
  const diaCiclo = ((dia - 1) % 360) + 1;
  if (diaCiclo <= 90) return 'Primavera';
  if (diaCiclo <= 180) return 'Verão';
  if (diaCiclo <= 270) return 'Outono';
  return 'Inverno';
}

/**
 * Processa o avanço de dias (1, 3 ou até o próximo marco semanal/mensal),
 * aplicando consumo, produção, manutenção e eventos sazonais.
 */
export function avancarDiasTurno(
  cidade: CidadeEstado,
  diasParaAvancar: number,
  prng: () => number,
  seedStr: string
): {
  novaCidade: CidadeEstado;
  relatorio: RelatorioTurno;
  novosLogs: LogEntry[];
} {
  let diaAtual = cidade.dia;
  const diaFinal = diaAtual + diasParaAvancar;

  // Clones defensivos
  const recursos: RecursosCidade = { ...cidade.recursos };
  let populacao = cidade.populacao;
  let moral = cidade.moral;
  let estabilidade = cidade.estabilidade;
  const construcoes = cidade.construcoes.map((c) => ({ ...c }));

  const fasesDisparadas = new Set<'micro' | 'semanal' | 'mensal'>();
  const obrasConcluidas: string[] = [];
  const eventosOcorridos: string[] = [];
  const novosLogs: LogEntry[] = [];

  const deltaTotal: Partial<RecursosCidade> & { populacao?: number; moral?: number; estabilidade?: number } = {
    viveres: 0,
    ouro: 0,
    madeira: 0,
    pedra: 0,
    minerio: 0,
    moral: 0,
    estabilidade: 0,
    populacao: 0,
  };

  // Itera dia a dia para disparar marcos nas datas corretas
  while (diaAtual < diaFinal) {
    diaAtual++;
    const estacaoAtual = calcularEstacao(diaAtual);

    // 1. Atualização de construções em obras
    for (const c of construcoes) {
      if (c.status === 'em_obras') {
        c.diasRestantes = Math.max(0, c.diasRestantes - 1);
        if (c.diasRestantes === 0) {
          c.status = 'concluida';
          obrasConcluidas.push(c.nome);
          novosLogs.push({
            id: `obra-concluida-${diaAtual}-${c.id}`,
            dia: diaAtual,
            estacao: estacaoAtual,
            fase: 'micro',
            tipo: 'producao',
            titulo: `Construção Concluída: ${c.nome}`,
            texto: `A obra de "${c.nome}" foi finalizada com sucesso! Efeito ativado: ${c.efeito}`,
            seedUsada: seedStr,
            timestamp: Date.now(),
          });
        }
      }
    }

    // 2. Marco Semanal (a cada 7 dias)
    if (diaAtual % 7 === 0) {
      fasesDisparadas.add('semanal');

      // Consumo de alimentos
      const consumoViveres = Math.max(1, Math.round(populacao * REGRAS_TURNOS.consumoPerCapitaSemanal.viveresPorHabitante));
      recursos.viveres -= consumoViveres;
      deltaTotal.viveres = (deltaTotal.viveres || 0) - consumoViveres;

      // Se faltar comida, moral cai e população sofre
      if (recursos.viveres < 0) {
        moral = Math.max(0, moral - 10);
        estabilidade = Math.max(0, estabilidade - 8);
        deltaTotal.moral = (deltaTotal.moral || 0) - 10;
        deltaTotal.estabilidade = (deltaTotal.estabilidade || 0) - 8;
        eventosOcorridos.push(`Escassez de Alimentos no Dia ${diaAtual}: Faltam víveres! Moral e Estabilidade abaladas.`);
      }

      // Produção de oficinas e manufaturas
      const multInd = Math.pow(REGRAS_TURNOS.producaoSemanalBase.multiplicadorPorIndustria, cidade.industria);
      const prodOuro = Math.round(REGRAS_TURNOS.producaoSemanalBase.ouro * multInd);
      const prodMadeira = Math.round(REGRAS_TURNOS.producaoSemanalBase.madeira * multInd);
      const prodPedra = Math.round(REGRAS_TURNOS.producaoSemanalBase.pedra * multInd);
      const prodMinerio = Math.round(REGRAS_TURNOS.producaoSemanalBase.minerio * multInd);

      recursos.ouro += prodOuro;
      recursos.madeira += prodMadeira;
      recursos.pedra += prodPedra;
      recursos.minerio += prodMinerio;

      deltaTotal.ouro = (deltaTotal.ouro || 0) + prodOuro;
      deltaTotal.madeira = (deltaTotal.madeira || 0) + prodMadeira;
      deltaTotal.pedra = (deltaTotal.pedra || 0) + prodPedra;
      deltaTotal.minerio = (deltaTotal.minerio || 0) + prodMinerio;

      // Lucro das rotas comerciais ativas
      let lucroRotas = 0;
      for (const rota of cidade.rotas) {
        if (rota.ativa && rota.frequencia === 'semanal') {
          lucroRotas += rota.lucroEstimadoOuro;
        }
      }
      if (lucroRotas > 0) {
        recursos.ouro += lucroRotas;
        deltaTotal.ouro = (deltaTotal.ouro || 0) + lucroRotas;
      }

      novosLogs.push({
        id: `fase-semanal-${diaAtual}`,
        dia: diaAtual,
        estacao: estacaoAtual,
        fase: 'semanal',
        tipo: 'turno_semanal',
        titulo: `Fase Semanal (Dia ${diaAtual})`,
        texto: `Consumo: -${consumoViveres} Víveres | Produção: +${prodOuro} Ouro, +${prodMadeira} Madeira, +${prodPedra} Pedra, +${prodMinerio} Minério${lucroRotas > 0 ? ` | Rotas comerciais: +${lucroRotas} Ouro` : ''}.`,
        deltaRecursos: {
          viveres: -consumoViveres,
          ouro: prodOuro + lucroRotas,
          madeira: prodMadeira,
          pedra: prodPedra,
          minerio: prodMinerio,
        },
        seedUsada: seedStr,
        timestamp: Date.now(),
      });
    }

    // 3. Marco Mensal (a cada 30 dias)
    if (diaAtual % 30 === 0) {
      fasesDisparadas.add('mensal');

      // Impostos municipais
      const impostoArrecadado = Math.max(5, Math.round(populacao * REGRAS_TURNOS.faseMensal.impostoBasePorHabitante));
      recursos.ouro += impostoArrecadado;
      deltaTotal.ouro = (deltaTotal.ouro || 0) + impostoArrecadado;

      // Colheita sazonal
      const chaveEstacao = estacaoAtual.toLowerCase() as 'primavera' | 'verao' | 'outono' | 'inverno';
      const colheita = REGRAS_TURNOS.faseMensal.colheitaSazonal[chaveEstacao] || 25;
      recursos.viveres += colheita;
      deltaTotal.viveres = (deltaTotal.viveres || 0) + colheita;

      // Manutenção de infraestrutura (custo baseado nas construções concluídas)
      const obrasConcluidasQtd = construcoes.filter((c) => c.status === 'concluida').length;
      const custoManutencao = Math.max(2, obrasConcluidasQtd * 3);
      recursos.ouro -= custoManutencao;
      deltaTotal.ouro = (deltaTotal.ouro || 0) - custoManutencao;

      // Rolagem de desastre/evento sazonal
      const tabelaDesastres = TODAS_TABELAS.find((t) => t.id === 'desastres_sazonais');
      let textoDesastre = 'Mês pacífico sem desastres.';
      if (tabelaDesastres) {
        const rollDesastre = roll1d100(prng);
        textoDesastre = consultarTabela(tabelaDesastres, rollDesastre);
      }
      eventosOcorridos.push(`Desastre/Evento Sazonal (Dia ${diaAtual}): ${textoDesastre}`);

      novosLogs.push({
        id: `fase-mensal-${diaAtual}`,
        dia: diaAtual,
        estacao: estacaoAtual,
        fase: 'mensal',
        tipo: 'turno_mensal',
        titulo: `Fase Mensal (Dia ${diaAtual} · ${estacaoAtual})`,
        texto: `Tributos: +${impostoArrecadado} Ouro | Safra (${estacaoAtual}): +${colheita} Víveres | Manutenção: -${custoManutencao} Ouro. Evento Sazonal: ${textoDesastre}`,
        deltaRecursos: {
          ouro: impostoArrecadado - custoManutencao,
          viveres: colheita,
        },
        seedUsada: seedStr,
        timestamp: Date.now(),
      });
    }

    // 4. Sugestão de Micro-evento (a cada 3 dias, se não for dia 7 ou 30)
    if (diaAtual % 3 === 0 && diaAtual % 7 !== 0 && diaAtual % 30 !== 0) {
      fasesDisparadas.add('micro');
    }
  }

  const estacaoFinal = calcularEstacao(diaFinal);

  const novaCidade: CidadeEstado = {
    ...cidade,
    dia: diaFinal,
    estacao: estacaoFinal,
    populacao,
    moral: Math.min(100, Math.max(0, moral)),
    estabilidade: Math.min(100, Math.max(0, estabilidade)),
    recursos,
    construcoes,
  };

  const relatorio: RelatorioTurno = {
    diasAvancados: diasParaAvancar,
    diaAtual: diaFinal,
    estacaoAtual: estacaoFinal,
    fasesDisparadas: Array.from(fasesDisparadas),
    resumoTexto: `Avançados ${diasParaAvancar} dia(s). Dia atual: ${diaFinal} (${estacaoFinal}).`,
    deltaRecursos: deltaTotal,
    obrasConcluidas,
    eventosOcorridos,
  };

  return {
    novaCidade,
    relatorio,
    novosLogs,
  };
}
