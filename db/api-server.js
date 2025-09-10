const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

router.use(cors());
router.use(express.json());

const dbConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false }
  : {
      host: 'isdb.uod.otago.ac.nz',
      user: 'hogka652',
      port: 5432,
      password: 'mee3jai4waed',
      database: 'cosc345'
    };


const pool = new Pool(dbConfig);

// ensure users table exists
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL
      );
    `);
    console.log('Database connected');
  } catch (err) {
    console.error('Database error (creating tables):', err);
  }
})();

router.get('/test', async (req, res) => {
  try {
    const r = await pool.query('SELECT NOW()');
    res.json({ ok: true, now: r.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sign Up
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.json({ success: false, message: 'Missing fields' });
  if (password.length < 8)
    return res.json({ success: false, message: 'Password must be at least 8 characters long' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const insert = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username',
      [username, email, hash]
    );
    // set session
    if (req && req.session) {
      req.session.userId = insert.rows[0].id;
      req.session.username = insert.rows[0].username;
    }
    res.json({ success: true, message: 'Signup successful!' });
  } catch (err) {
    console.error('Signup error:', err);
    if (err.code === '23505') {
      res.json({ success: false, message: 'Username or email already exists' });
    } else {
      res.json({ success: false, message: 'Signup failed' });
    }
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ success: false, message: 'Missing fields' });
  try {
    const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.json({ success: false, message: 'Invalid credentials' });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.json({ success: false, message: 'Invalid credentials' });
    if (req && req.session) {
      req.session.userId = user.id;
      req.session.username = user.username;
    }
    res.json({ success: true, message: 'Login successful!' });
  } catch (err) {
    console.error('Login error:', err);
    res.json({ success: false, message: 'Login failed' });
  }
});

// return session info
router.get('/me', (req, res) => {
  if (req && req.session && req.session.userId) {
    res.json({ loggedIn: true, user: { id: req.session.userId, username: req.session.username } });
  } else {
    res.json({ loggedIn: false });
  }
});

// logout
router.post('/logout', (req, res) => {
  if (!req || !req.session) return res.json({ success: true });
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});


/**Ensure session is being recorded into the databse */
router.post('/chat-sessions', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const now = new Date();

    //chekc is user is logged in, if not, anon users get null
    const userId = req.session?.user_id || null; //whats our auth system?

    
    const result = await pool.query(`
      INSERT INTO Chat_Session (
        session_id, user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4)
      RETURNING session_id, user_id
    `, [sessionId, userId, now, now]); // null for anonymous users

    res.json({
      session_id: result.rows[0].session_id,
      is_anonymous: result.rows[0].user_id === null
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});



module.exports = router;

/*
//API server on port 3001 
app.listen(3001, () => {
  console.log('API server running on http://localhost:3001');
  console.log('Website on http://localhost:3000');
  console.log('Test API http://localhost:3001/api/test');
});



Inspect -> Console -> Paste each test
//basic API test
fetch('http://localhost:3001/api/test')
  .then(response => response.json())
  .then(data => console.log('API Test:', data));

//get database users
fetch('http://localhost:3001/api/users')  
  .then(response => response.json())
  .then(users => console.log('Database Users:', users));

//test chat
fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello!' })
})
  .then(response => response.json())
  .then(data => console.log('Chat Test:', data));
*/