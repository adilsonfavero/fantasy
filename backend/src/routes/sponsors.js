const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Get all sponsors (Public)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM sponsors ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar patrocinadores' });
  }
});

// Add a sponsor (Admin only)
router.post('/', requireAdmin, async (req, res) => {
  const { name, logo_url, website_url, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Nome da empresa patrocinadora é obrigatório.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO sponsors (name, logo_url, website_url, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, logo_url, website_url, description]
    );
    res.status(201).json({ message: 'Patrocinador adicionado com sucesso!', sponsor: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao cadastrar patrocinador' });
  }
});

// Delete a sponsor (Admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM sponsors WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Patrocinador não encontrado.' });
    }
    res.json({ message: 'Patrocinador removido com sucesso!', sponsor: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao remover patrocinador.' });
  }
});

module.exports = router;
