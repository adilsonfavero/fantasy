const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get all teams for the logged-in user
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(`
      SELECT ut.*, r.name as race_name 
      FROM user_teams ut
      JOIN races r ON ut.race_id = r.id
      WHERE ut.user_id = $1
      ORDER BY ut.created_at DESC
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar suas equipes.' });
  }
});

// Get user team for a specific race, including athlete details
router.get('/race/:raceId', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { raceId } = req.params;

  try {
    const teamResult = await db.query(
      'SELECT * FROM user_teams WHERE user_id = $1 AND race_id = $2',
      [userId, raceId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ message: 'Nenhuma equipe criada para esta prova ainda.', noTeam: true });
    }

    const team = teamResult.rows[0];

    // Fetch athletes for this team
    const athletesResult = await db.query(`
      SELECT a.* 
      FROM athletes a
      JOIN team_athletes ta ON a.id = ta.athlete_id
      WHERE ta.user_team_id = $1
    `, [team.id]);

    team.athletes = athletesResult.rows;
    res.json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar detalhes da equipe.' });
  }
});

// Create or update a fantasy team
router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { race_id, team_name, sports_director, jersey_icon, country, athlete_ids } = req.body;

  // Basic validation
  if (!race_id || !team_name || !sports_director || !jersey_icon || !country || !athlete_ids) {
    return res.status(400).json({ message: 'Todos os campos da equipe são obrigatórios.' });
  }

  // Check athlete count
  if (!Array.isArray(athlete_ids) || athlete_ids.length !== 8) {
    return res.status(400).json({ message: 'A equipe precisa ter exatamente 8 atletas.' });
  }

  // Remove duplicates just in case
  const uniqueAthleteIds = [...new Set(athlete_ids)];
  if (uniqueAthleteIds.length !== 8) {
    return res.status(400).json({ message: 'Não é permitido selecionar o mesmo atleta mais de uma vez.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Fetch details of selected athletes from database to calculate real cost and verify race_id
    const athletesResult = await client.query(
      'SELECT id, name, value, race_id FROM athletes WHERE id = ANY($1)',
      [uniqueAthleteIds]
    );

    if (athletesResult.rows.length !== 8) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Um ou mais atletas selecionados não foram encontrados no banco de dados.' });
    }

    // Verify all athletes belong to the selected race
    const wrongRaceAthletes = athletesResult.rows.filter(a => a.race_id !== parseInt(race_id));
    if (wrongRaceAthletes.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Todos os atletas devem pertencer à prova selecionada.' });
    }

    // Calculate total cost
    const totalSpent = athletesResult.rows.reduce((sum, athlete) => sum + athlete.value, 0);
    if (totalSpent > 1000) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        message: `O valor total da equipe (${totalSpent} dinheiros) excede o orçamento limite de 1000 dinheiros.` 
      });
    }

    // Insert or update user_teams
    const teamInsertResult = await client.query(`
      INSERT INTO user_teams (user_id, race_id, team_name, sports_director, jersey_icon, country, total_spent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, race_id) 
      DO UPDATE SET 
        team_name = EXCLUDED.team_name,
        sports_director = EXCLUDED.sports_director,
        jersey_icon = EXCLUDED.jersey_icon,
        country = EXCLUDED.country,
        total_spent = EXCLUDED.total_spent
      RETURNING id
    `, [userId, race_id, team_name.trim(), sports_director.trim(), jersey_icon, country.trim(), totalSpent]);

    const teamId = teamInsertResult.rows[0].id;

    // Delete existing athletes associated with this team (in case of update)
    await client.query('DELETE FROM team_athletes WHERE user_team_id = $1', [teamId]);

    // Insert new athletes for this team
    for (const athleteId of uniqueAthleteIds) {
      await client.query(
        'INSERT INTO team_athletes (user_team_id, athlete_id) VALUES ($1, $2)',
        [teamId, athleteId]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Equipe salva com sucesso!',
      teamId,
      totalSpent
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Erro ao salvar equipe no banco de dados.' });
  } finally {
    client.release();
  }
});

module.exports = router;
