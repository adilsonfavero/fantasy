const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Get all races (Grandes Voltas)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM races ORDER BY name ASC');
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

module.exports = router;
