const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretcyclingfantasykey123!';

// Register Route
router.post('/register', async (req, res) => {
  const { email, password, birth_date, country, state, city } = req.body;

  if (!email || !password || !birth_date || !country || !state || !city) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios (e-mail, senha, data de nascimento, país, estado e cidade).' });
  }

  try {
    // Check if user already exists
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Este e-mail já está cadastrado.' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Save user
    const newUser = await db.query(
      'INSERT INTO users (email, password_hash, is_admin, birth_date, country, state, city) VALUES ($1, $2, FALSE, $3, $4, $5, $6) RETURNING id, email, is_admin',
      [email.toLowerCase().trim(), passwordHash, birth_date, country, state, city]
    );

    // Create token
    const token = jwt.sign(
      { id: newUser.rows[0].id, email: newUser.rows[0].email, isAdmin: newUser.rows[0].is_admin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      token,
      user: { id: newUser.rows[0].id, email: newUser.rows[0].email, isAdmin: newUser.rows[0].is_admin }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno do servidor ao registrar usuário.' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'E-mail ou senha incorretos.' });
    }

    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'E-mail ou senha incorretos.' });
    }

    // Create token
    const token = jwt.sign(
      { id: user.id, email: user.email, isAdmin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login realizado com sucesso!',
      token,
      user: { id: user.id, email: user.email, isAdmin: user.is_admin }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno do servidor ao realizar login.' });
  }
});

// Get current profile (verifies JWT token validity)
router.get('/profile', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Não autenticado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userResult = await db.query(
      "SELECT id, email, is_admin, to_char(birth_date, 'YYYY-MM-DD') as birth_date, country, state, city FROM users WHERE id = $1", 
      [decoded.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const row = userResult.rows[0];
    res.json({ 
      user: { 
        id: row.id, 
        email: row.email, 
        isAdmin: row.is_admin,
        birthDate: row.birth_date,
        country: row.country,
        state: row.state,
        city: row.city
      } 
    });
  } catch (err) {
    res.status(401).json({ message: 'Token expirado ou inválido' });
  }
});

// User Administration: Get all users (Admin only)
const { requireAdmin } = require('../middleware/auth');

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, email, is_admin, to_char(birth_date, 'YYYY-MM-DD') as birth_date, country, state, city, created_at FROM users ORDER BY email ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar usuários.' });
  }
});

// User Administration: Toggle Admin status (Admin only)
router.put('/users/:id/toggle-admin', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const currentAdminId = req.user.id;

  if (parseInt(id) === currentAdminId) {
    return res.status(400).json({ message: 'Você não pode revogar seus próprios privilégios de administrador.' });
  }

  try {
    const userCheck = await db.query('SELECT is_admin FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    const newAdminStatus = !userCheck.rows[0].is_admin;
    await db.query('UPDATE users SET is_admin = $1 WHERE id = $2', [newAdminStatus, id]);

    res.json({ message: 'Status de administrador atualizado com sucesso!', is_admin: newAdminStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao atualizar privilégios do usuário.' });
  }
});

// User Administration: Delete user account (Admin only)
router.delete('/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const currentAdminId = req.user.id;

  if (parseInt(id) === currentAdminId) {
    return res.status(400).json({ message: 'Você não pode excluir sua própria conta de administrador.' });
  }

  try {
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    res.json({ message: 'Usuário removido com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao remover usuário.' });
  }
});

// User Administration: Create a new admin user (Admin only)
router.post('/users/admin', requireAdmin, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
  }

  try {
    // Check if user already exists
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Este e-mail já está cadastrado.' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Save user with is_admin = true
    const newUser = await db.query(
      'INSERT INTO users (email, password_hash, is_admin) VALUES ($1, $2, TRUE) RETURNING id, email, is_admin',
      [email.toLowerCase().trim(), passwordHash]
    );

    res.status(201).json({
      message: 'Administrador cadastrado com sucesso!',
      user: { id: newUser.rows[0].id, email: newUser.rows[0].email, isAdmin: newUser.rows[0].is_admin }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao cadastrar administrador.' });
  }
});

module.exports = router;
