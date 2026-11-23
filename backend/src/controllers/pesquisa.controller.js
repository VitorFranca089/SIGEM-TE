// Pesquisa do catalogo do SIGEM. Os resultados sao montados a partir dos
// registros ativos do banco; a tela nao deve manter um catalogo paralelo fixo.

const pool = require('../config/db');

const TIPOS_VALIDOS = new Set([
  'todos',
  'aulas',
  'instrumentos',
  'grupos',
  'professores',
  'classes'
]);

function erro(res, status, message) {
  return res.status(status).json({ status: 'erro', message });
}

async function listar(req, res) {
  const termo = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const tipo = typeof req.query.tipo === 'string' ? req.query.tipo : 'todos';

  if (termo.length > 100) return erro(res, 400, 'O termo de pesquisa pode ter no máximo 100 caracteres');
  if (!TIPOS_VALIDOS.has(tipo)) return erro(res, 400, 'Categoria de pesquisa inválida');

  try {
    const resultado = await pool.query(`
      WITH resultados AS (
        SELECT
          'aulas'::text AS tipo,
          ARRAY['aulas', 'instrumentos']::text[] AS categorias,
          c.id::text AS referencia_id,
          c.nome AS titulo,
          COALESCE(NULLIF(c.descricao, ''), 'Curso disponivel no SIGEM') AS detalhe,
          '♫'::text AS icone,
          'classes.html'::text AS link
        FROM curso c
        WHERE c.ativo = true

        UNION ALL

        SELECT
          'classes'::text AS tipo,
          ARRAY['classes', 'aulas']::text[] AS categorias,
          t.id::text AS referencia_id,
          t.nome AS titulo,
          CONCAT_WS(
            ' · ',
            c.nome,
            pu.nome,
            CASE t.dia_semana
              WHEN 0 THEN 'Domingo'
              WHEN 1 THEN 'Segunda-feira'
              WHEN 2 THEN 'Terca-feira'
              WHEN 3 THEN 'Quarta-feira'
              WHEN 4 THEN 'Quinta-feira'
              WHEN 5 THEN 'Sexta-feira'
              WHEN 6 THEN 'Sabado'
            END,
            TO_CHAR(t.hora_inicio, 'HH24:MI') || ' - ' || TO_CHAR(t.hora_fim, 'HH24:MI')
          ) AS detalhe,
          '☷'::text AS icone,
          'classes.html'::text AS link
        FROM turma t
        JOIN curso c ON c.id = t.curso_id
        JOIN professor p ON p.id = t.professor_id
        JOIN usuario pu ON pu.id = p.usuario_id
        WHERE t.ativo = true
          AND t.status = 'ativa'
          AND pu.ativo = true

        UNION ALL

        SELECT
          'grupos'::text AS tipo,
          ARRAY['grupos']::text[] AS categorias,
          g.id::text AS referencia_id,
          g.nome AS titulo,
          COALESCE(NULLIF(g.descricao, ''), 'Grupo extracurricular') AS detalhe,
          '♫'::text AS icone,
          'grupos.html'::text AS link
        FROM grupo g
        WHERE g.ativo = true

        UNION ALL

        SELECT
          'professores'::text AS tipo,
          ARRAY['professores']::text[] AS categorias,
          p.id::text AS referencia_id,
          u.nome AS titulo,
          COALESCE(NULLIF(p.especialidades, ''), 'Professor do SIGEM') AS detalhe,
          '◉'::text AS icone,
          'contatos.html'::text AS link
        FROM professor p
        JOIN usuario u ON u.id = p.usuario_id
        WHERE u.ativo = true
      )
      SELECT tipo, categorias, referencia_id, titulo, detalhe, icone, link
      FROM resultados
      WHERE ($2 = 'todos' OR $2 = ANY(categorias))
        AND (
          $1 = ''
          OR titulo ILIKE '%' || $1 || '%'
          OR detalhe ILIKE '%' || $1 || '%'
        )
      ORDER BY titulo
      LIMIT 100
    `, [termo, tipo]);

    res.json({ status: 'ok', dados: resultado.rows });
  } catch (e) {
    erro(res, 500, 'Falha ao pesquisar no catálogo');
  }
}

module.exports = { listar };
