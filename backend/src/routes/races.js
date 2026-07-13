const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Get all races (Grandes Voltas)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, 
        name, 
        description, 
        year,
        to_char(start_date, 'YYYY-MM-DD') as start_date,
        to_char(end_date, 'YYYY-MM-DD') as end_date,
        CASE 
          WHEN start_date IS NULL OR end_date IS NULL THEN FALSE
          ELSE CURRENT_DATE BETWEEN start_date AND end_date
        END as is_active
      FROM races 
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar provas de ciclismo.' });
  }
});

// Get athletes for a specific race
router.get('/:id/athletes', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM athletes WHERE race_id = $1 ORDER BY value DESC, name ASC', [id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar atletas para a prova.' });
  }
});

// Add an athlete (Admin only)
router.post('/athletes', requireAdmin, async (req, res) => {
  const { race_id, name, nationality, official_team, value } = req.body;

  if (!race_id || !name || !nationality || !official_team || value === undefined) {
    return res.status(400).json({ message: 'Todos os campos do atleta são obrigatórios (race_id, name, nationality, official_team, value).' });
  }

  try {
    // Check if race exists
    const raceCheck = await db.query('SELECT * FROM races WHERE id = $1', [race_id]);
    if (raceCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Corrida (race_id) informada não existe.' });
    }

    const result = await db.query(
      'INSERT INTO athletes (race_id, name, nationality, official_team, value) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [race_id, name, nationality, official_team, value]
    );

    res.status(201).json({ message: 'Atleta cadastrado com sucesso!', athlete: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao cadastrar atleta.' });
  }
});

// Update an athlete (Admin only)
router.put('/athletes/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, nationality, official_team, value } = req.body;

  console.log('PUT /athletes/:id params:', req.params);
  console.log('PUT /athletes/:id body:', req.body);

  if (!name || !nationality || !official_team || value === undefined) {
    console.log('PUT /athletes/:id validation failed');
    return res.status(400).json({ message: 'Todos os campos do atleta são obrigatórios (name, nationality, official_team, value).' });
  }

  try {
    const result = await db.query(
      'UPDATE athletes SET name = $1, nationality = $2, official_team = $3, value = $4 WHERE id = $5 RETURNING *',
      [name, nationality, official_team, value, id]
    );

    if (result.rows.length === 0) {
      console.log('PUT /athletes/:id athlete not found');
      return res.status(404).json({ message: 'Atleta não encontrado.' });
    }

    res.json({ message: 'Atleta atualizado com sucesso!', athlete: result.rows[0] });
  } catch (err) {
    console.error('PUT /athletes/:id db error:', err);
    res.status(500).json({ message: 'Erro ao atualizar atleta.' });
  }
});

// Delete an athlete (Admin only)
router.delete('/athletes/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM athletes WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Atleta não encontrado.' });
    }

    res.json({ message: 'Atleta removido com sucesso!', athlete: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao remover atleta.' });
  }
});

// Get stages for a specific race
router.get('/:id/stages', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT id, race_id, stage_number, to_char(date, \'YYYY-MM-DD\') as date, start_location, end_location, distance_km, profile_type, image_url FROM race_stages WHERE race_id = $1 ORDER BY stage_number ASC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar etapas da prova.' });
  }
});

// Add a new race/event (Admin only)
router.post('/', requireAdmin, async (req, res) => {
  const { name, description, year, start_date, end_date } = req.body;

  if (!name || !year || !start_date || !end_date) {
    return res.status(400).json({ message: 'Nome, ano, data de início e data de fim são obrigatórios.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO races (name, description, year, start_date, end_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, description, year, to_char(start_date, 'YYYY-MM-DD') as start_date, to_char(end_date, 'YYYY-MM-DD') as end_date`,
      [name, description, parseInt(year), start_date, end_date]
    );

    res.status(201).json({ message: 'Evento criado com sucesso!', race: result.rows[0] });
  } catch (err) {
    console.error('Error creating race:', err);
    res.status(500).json({ message: 'Erro ao criar evento.' });
  }
});

// Update an existing race/event (Admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, year, start_date, end_date } = req.body;

  if (!name || !year || !start_date || !end_date) {
    return res.status(400).json({ message: 'Nome, ano, data de início e data de fim são obrigatórios.' });
  }

  try {
    const result = await db.query(
      `UPDATE races 
       SET name = $1, description = $2, year = $3, start_date = $4, end_date = $5 
       WHERE id = $6 
       RETURNING id, name, description, year, to_char(start_date, 'YYYY-MM-DD') as start_date, to_char(end_date, 'YYYY-MM-DD') as end_date`,
      [name, description, parseInt(year), start_date, end_date, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Evento não encontrado.' });
    }

    res.json({ message: 'Evento atualizado com sucesso!', race: result.rows[0] });
  } catch (err) {
    console.error('Error updating race:', err);
    res.status(500).json({ message: 'Erro ao atualizar evento.' });
  }
});

// ========== JERSEY TYPES ==========

// GET jerseys for a race
router.get('/:id/jerseys', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM jersey_types WHERE race_id = $1 ORDER BY id ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar camisas.' });
  }
});

// POST create a jersey type (Admin only)
router.post('/:id/jerseys', requireAdmin, async (req, res) => {
  const { name, color, icon, points_per_stage } = req.body;
  if (!name) return res.status(400).json({ message: 'Nome da camisa é obrigatório.' });
  try {
    const result = await db.query(
      'INSERT INTO jersey_types (race_id, name, color, icon, points_per_stage) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.id, name, color || '#FFFFFF', icon || '👕', points_per_stage || 0]
    );
    res.status(201).json({ message: 'Camisa criada com sucesso!', jersey: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao criar camisa.' });
  }
});

// PUT update a jersey type (Admin only)
router.put('/jerseys/:id', requireAdmin, async (req, res) => {
  const { name, color, icon, points_per_stage } = req.body;
  if (!name) return res.status(400).json({ message: 'Nome da camisa é obrigatório.' });
  try {
    const result = await db.query(
      'UPDATE jersey_types SET name=$1, color=$2, icon=$3, points_per_stage=$4 WHERE id=$5 RETURNING *',
      [name, color || '#FFFFFF', icon || '👕', points_per_stage || 0, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Camisa não encontrada.' });
    res.json({ message: 'Camisa atualizada com sucesso!', jersey: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao atualizar camisa.' });
  }
});

// DELETE a jersey type (Admin only)
router.delete('/jerseys/:id', requireAdmin, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM jersey_types WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Camisa não encontrada.' });
    res.json({ message: 'Camisa removida com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao remover camisa.' });
  }
});

// ========== SCORING RULES ==========

// GET scoring rules for a race
router.get('/:id/scoring-rules', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM scoring_rules WHERE race_id = $1 ORDER BY position ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar tabela de pontuação.' });
  }
});

// POST save/replace scoring rules for a race (Admin only)
// Body: { rules: [{position: 1, points: 50}, ...] }
router.post('/:id/scoring-rules', requireAdmin, async (req, res) => {
  const { rules } = req.body;
  if (!Array.isArray(rules) || rules.length === 0) {
    return res.status(400).json({ message: 'Regras de pontuação inválidas.' });
  }
  try {
    for (const rule of rules) {
      await db.query(
        `INSERT INTO scoring_rules (race_id, position, points) VALUES ($1, $2, $3)
         ON CONFLICT (race_id, position) DO UPDATE SET points = EXCLUDED.points`,
        [req.params.id, rule.position, rule.points]
      );
    }
    res.json({ message: 'Tabela de pontuação salva com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao salvar tabela de pontuação.' });
  }
});

// ========== STAGE RESULTS ==========

// GET results for a stage
router.get('/stages/:stageId/results', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sr.id, sr.stage_id, sr.position, sr.points_awarded,
             a.id as athlete_id, a.name as athlete_name, a.nationality, a.official_team
      FROM stage_results sr
      JOIN athletes a ON sr.athlete_id = a.id
      WHERE sr.stage_id = $1
      ORDER BY sr.position ASC
    `, [req.params.stageId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar resultados da etapa.' });
  }
});

// POST save stage results (upsert, Admin only)
// Body: { results: [{position, athlete_id, points_awarded}, ...] }
router.post('/stages/:stageId/results', requireAdmin, async (req, res) => {
  const { results } = req.body;
  if (!Array.isArray(results)) {
    return res.status(400).json({ message: 'Resultados inválidos.' });
  }
  try {
    // Delete existing results for this stage and re-insert
    await db.query('DELETE FROM stage_results WHERE stage_id = $1', [req.params.stageId]);
    for (const r of results) {
      if (r.athlete_id) {
        await db.query(
          'INSERT INTO stage_results (stage_id, athlete_id, position, points_awarded) VALUES ($1, $2, $3, $4)',
          [req.params.stageId, r.athlete_id, r.position, r.points_awarded || 0]
        );
      }
    }
    res.json({ message: 'Resultado da etapa salvo com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao salvar resultado da etapa.' });
  }
});

// ========== STAGE JERSEY LEADERS ==========

// GET jersey leaders for a stage
router.get('/stages/:stageId/jersey-leaders', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sjl.id, sjl.stage_id, sjl.jersey_type_id, sjl.athlete_id,
             jt.name as jersey_name, jt.color as jersey_color, jt.icon as jersey_icon, jt.points_per_stage,
             a.name as athlete_name, a.nationality, a.official_team
      FROM stage_jersey_leaders sjl
      JOIN jersey_types jt ON sjl.jersey_type_id = jt.id
      JOIN athletes a ON sjl.athlete_id = a.id
      WHERE sjl.stage_id = $1
      ORDER BY jt.id ASC
    `, [req.params.stageId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar líderes de camisa da etapa.' });
  }
});

// POST save jersey leaders for a stage (upsert, Admin only)
// Body: { leaders: [{jersey_type_id, athlete_id}, ...] }
router.post('/stages/:stageId/jersey-leaders', requireAdmin, async (req, res) => {
  const { leaders } = req.body;
  if (!Array.isArray(leaders)) {
    return res.status(400).json({ message: 'Líderes inválidos.' });
  }
  try {
    // Delete existing leaders for this stage and re-insert
    await db.query('DELETE FROM stage_jersey_leaders WHERE stage_id = $1', [req.params.stageId]);
    for (const l of leaders) {
      if (l.jersey_type_id && l.athlete_id) {
        await db.query(
          'INSERT INTO stage_jersey_leaders (stage_id, jersey_type_id, athlete_id) VALUES ($1, $2, $3)',
          [req.params.stageId, l.jersey_type_id, l.athlete_id]
        );
      }
    }
    res.json({ message: 'Líderes de camisa salvos com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao salvar líderes de camisa.' });
  }
});

module.exports = router;
