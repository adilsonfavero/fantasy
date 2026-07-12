const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// 1. Create League (Logged in users)
router.post('/', authenticateToken, async (req, res) => {
  const { name, race_id } = req.body;
  const userId = req.user.id;

  if (!name || !race_id) {
    return res.status(400).json({ message: 'O nome da liga e a prova são obrigatórios.' });
  }

  try {
    // Check if race exists and is active
    const raceCheck = await db.query(
      `SELECT id, name, 
       CASE 
         WHEN start_date IS NULL OR end_date IS NULL THEN FALSE
         ELSE CURRENT_DATE BETWEEN start_date AND end_date
       END as is_active 
       FROM races WHERE id = $1`,
      [race_id]
    );

    if (raceCheck.rows.length === 0) {
      return res.status(400).json({ message: 'A prova/evento informada não existe.' });
    }

    if (!raceCheck.rows[0].is_active) {
      return res.status(400).json({ message: 'Essa prova não está ativa no momento. Ligas só podem ser criadas para eventos do período atual.' });
    }

    // Generate unique 6-digit numeric sharing code
    let code = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      const codeCheck = await db.query('SELECT 1 FROM leagues WHERE code = $1', [code]);
      if (codeCheck.rows.length === 0) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ message: 'Erro ao gerar código da liga. Tente novamente.' });
    }

    // Insert League
    const leagueResult = await db.query(
      'INSERT INTO leagues (name, code, creator_id, race_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, code, userId, race_id]
    );
    const newLeague = leagueResult.rows[0];

    // Automatically join creator's team to the league if they already built a team for this race
    const teamCheck = await db.query(
      'SELECT id FROM user_teams WHERE user_id = $1 AND race_id = $2',
      [userId, race_id]
    );

    if (teamCheck.rows.length > 0) {
      const userTeamId = teamCheck.rows[0].id;
      await db.query(
        'INSERT INTO league_teams (league_id, user_team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [newLeague.id, userTeamId]
      );
    }

    res.status(201).json({
      message: 'Liga criada com sucesso!',
      league: newLeague,
      joinedCreatorTeam: teamCheck.rows.length > 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao criar liga de fantasy.' });
  }
});

// 2. Join League by code (Logged in users)
router.post('/join', authenticateToken, async (req, res) => {
  const { code } = req.body;
  const userId = req.user.id;

  if (!code) {
    return res.status(400).json({ message: 'O código numérico de compartilhamento é obrigatório.' });
  }

  try {
    // Find league and check if its race is active
    const leagueResult = await db.query(
      `SELECT l.*, 
       CASE 
         WHEN r.start_date IS NULL OR r.end_date IS NULL THEN FALSE
         ELSE CURRENT_DATE BETWEEN r.start_date AND r.end_date
       END as is_active 
       FROM leagues l
       JOIN races r ON l.race_id = r.id
       WHERE l.code = $1`,
      [code.trim()]
    );

    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ message: 'Liga não encontrada com o código informado.' });
    }
    const league = leagueResult.rows[0];

    if (!league.is_active) {
      return res.status(400).json({ message: 'Não é possível entrar em uma liga associada a um evento inativo.' });
    }

    // Check if user has a team for this league's race
    const teamResult = await db.query(
      'SELECT id FROM user_teams WHERE user_id = $1 AND race_id = $2',
      [userId, league.race_id]
    );

    if (teamResult.rows.length === 0) {
      return res.status(400).json({
        message: `Você precisa criar a sua equipe para o evento desta liga antes de participar. Monte sua equipe no menu principal primeiro!`
      });
    }

    const userTeamId = teamResult.rows[0].id;

    // Check if team is already in this league
    const checkExists = await db.query(
      'SELECT 1 FROM league_teams WHERE league_id = $1 AND user_team_id = $2',
      [league.id, userTeamId]
    );

    if (checkExists.rows.length > 0) {
      return res.status(400).json({ message: 'Sua equipe já está participando desta liga.' });
    }

    // Join
    await db.query(
      'INSERT INTO league_teams (league_id, user_team_id) VALUES ($1, $2)',
      [league.id, userTeamId]
    );

    res.json({ message: 'Você entrou na liga com sucesso!', league });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao ingressar na liga.' });
  }
});

// 3. Get all leagues user is in (Logged in users)
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(`
      SELECT 
        l.id, 
        l.name, 
        l.code, 
        l.created_at,
        r.name as race_name,
        r.year as race_year,
        u.email as creator_email,
        (SELECT COUNT(*) FROM league_teams lt WHERE lt.league_id = l.id) as members_count
      FROM leagues l
      JOIN races r ON l.race_id = r.id
      JOIN users u ON l.creator_id = u.id
      WHERE l.id IN (
        SELECT lt.league_id 
        FROM league_teams lt 
        JOIN user_teams ut ON lt.user_team_id = ut.id 
        WHERE ut.user_id = $1
      )
      ORDER BY l.created_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar ligas.' });
  }
});

// 4. Get League details and standings (Logged in users)
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Get league info
    const leagueResult = await db.query(`
      SELECT 
        l.id, 
        l.name, 
        l.code, 
        l.created_at,
        r.name as race_name,
        u.email as creator_email
      FROM leagues l
      JOIN races r ON l.race_id = r.id
      JOIN users u ON l.creator_id = u.id
      WHERE l.id = $1
    `, [id]);

    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ message: 'Liga não encontrada.' });
    }

    // 2. Get teams list in league sorted by points
    const standingsResult = await db.query(`
      SELECT 
        ut.id as team_id,
        ut.team_name,
        ut.sports_director,
        ut.jersey_icon,
        ut.country,
        ut.points,
        u.email as user_email
      FROM league_teams lt
      JOIN user_teams ut ON lt.user_team_id = ut.id
      JOIN users u ON ut.user_id = u.id
      WHERE lt.league_id = $1
      ORDER BY ut.points DESC, ut.team_name ASC
    `, [id]);

    res.json({
      league: leagueResult.rows[0],
      standings: standingsResult.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao carregar detalhes da liga.' });
  }
});

module.exports = router;
