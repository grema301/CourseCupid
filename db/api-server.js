/** api-server.js */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

router.use(cors());
router.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: "-c search_path=hogka652" });

pool.connect()
  .then(() => console.log('Database connected'))
  .catch(err => console.error('Database error:', err));

/*
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
  } catch (err) {
    console.error('Database error (creating tables):', err);
  }
})();*/

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
    const userID = uuidv4();
    const now = new Date();

    const insert = await pool.query(
      'INSERT INTO Web_User (user_id, username, email, password_hash, created_at, updated_at, is_registered) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING user_id, username',
      [userID, username, email, hash, now, now, true]
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
    const result = await pool.query('SELECT user_id, username, password_hash FROM Web_User WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.json({ success: false, message: 'Invalid credentials' });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.json({ success: false, message: 'Invalid credentials' });
    if (req && req.session) {
      req.session.userId = user.user_id;
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



/*
// Handle chat messages for a session (not paper)
router.post('/chat/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  const message = req.body.message;

  // Validate session exists
  const sessionCheck = await pool.query(
    'SELECT session_id FROM Chat_Session WHERE session_id = $1', 
    [sessionId]
  );
  
  if (sessionCheck.rows.length === 0) {
    return res.status(404).json({ reply: "Error: Session not found." });
  }

  // For now, return a simple response
  const reply = "Hello! This is a Cupid chat session. How can I help you today?";
  
  // TODO: Save message to database and call AI service
  
  res.json({ reply });
});*/

/*
// Get messages for a session (update the existing one)
router.get('/chat/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Validate session exists
    const sessionCheck = await pool.query(
      'SELECT session_id FROM Chat_Session WHERE session_id = $1', 
      [sessionId]
    );
    
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // For now return empty, implement message storage later
    res.json([]);
    
  } catch (error) {
    console.error('Error loading session messages:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});*/


// Handle chat messages, handles both sessions and papers
// If identifier is a UUID (session), handles it here. Otherwise calls next() 
// to pass paper chats to server.js where the paper AI is implemented.
router.post('/chat/:identifier', async (req, res, next) => {
  const identifier = req.params.identifier;
  const message = req.body.message;
  
  // Check if it's a session ID (UUID pattern)
  const isSessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  if (isSessionId) {
    // Validate session exists
    const sessionCheck = await pool.query(
      'SELECT session_id FROM Chat_Session WHERE session_id = $1', 
      [identifier]
    );
    
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ reply: "Error: Session not found." });
    }

    const reply = "Hello! This is a Cupid chat session. How can I help you today?";
    return res.json({ reply });
  } 

  next(); // Not a session ID, pass to server.js to handle paper AI chat
});





// Handle session-based chat messages (match frontend expectations)
router.get('/chat/:identifier/messages', async (req, res) => {
  try {
    const identifier = req.params.identifier;
    
    // Check if it's a session ID (UUID pattern)
    const isSessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    if (isSessionId) {
      // Validate session exists
      const sessionCheck = await pool.query(
        'SELECT session_id FROM Chat_Session WHERE session_id = $1', 
        [identifier]
      );
      
      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Return empty array for now, implement message storage later)
      return res.json([]);
    } else {
      // It's a paper code don't validate as UUID, just return empty for now
      // TODO: Implement paper message history from database
      return res.json([]);
    }
    
  } catch (error) {
    console.error('Error loading messages:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});





// Handle session-based chat history (fallback route frontend tries)
router.get('/chat/:identifier/history', async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const isSessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    if (isSessionId) {
      const sessionCheck = await pool.query(
        'SELECT session_id FROM Chat_Session WHERE session_id = $1', 
        [identifier]
      );
      
      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      return res.json([]);
    } else {
      return res.json([]);
    }
  } catch (error) {
    console.error('Error loading history:', error);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// Handle session-based first message
router.post('/chat/:identifier/first', async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const isSessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    if (isSessionId) {
      const sessionCheck = await pool.query(
        'SELECT session_id FROM Chat_Session WHERE session_id = $1', 
        [identifier]
      );
      
      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      return res.json({ reply: "Hi there! This is a cupid chat" });
    } else {
      //Handle paper-based first messages
      return res.json({ reply: "Check api-server.js /chat/:identifier/first" });
    }
  } catch (error) {
    console.error('Error with first message:', error);
    res.status(500).json({ error: 'Failed to get first message' });
  }
});



//DO NOT TOUCH Ensure session is being recorded into the databse
router.post('/chat-sessions', async (req, res) => {
  try {
    const session_ID = uuidv4();
    const now = new Date();

    //chekc is user is logged in, if not, anon users get null
    const userId = req.session?.userId || null; //whats our auth system?

    
    const result = await pool.query(`
      INSERT INTO Chat_Session (
        session_id, user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4)
      RETURNING session_id, user_id
    `, [session_ID, userId, now, now]); // null for anonymous users

    res.json({
      session_id: result.rows[0].session_id,
      is_anonymous: result.rows[0].user_id === null
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});

//DO NOT TOUCH Handle deleting a session
router.delete('/chat-sessions/:sessionID', async (req, res) => {
  try {
    const { sessionID } = req.params;
    
    if (!sessionID) {
      return res.status(400).json({ success: false, message: 'Session ID is required'});
    }

    //should add cascade to schema, deal with dependencies
    await pool.query('DELETE FROM Chat_Session WHERE session_id = $1', [sessionID]);
    
    res.json({ 
      success: true, message: 'Session deleted successfully', sessionID: sessionID
    });
    
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ success: false, message: 'Failed to delete session' });
  }
});

// Gets chat sessions to display based on login status
router.get('/chat-sessions', async (req, res) => {
  try {
    const loggedInUserId = req.session?.userId || null;
    const currentSessionId = req.query.currentSessionId || null; // Get from query param
    
    let query, params;
    
    if (loggedInUserId) {
      // Logged in: show all sessions for this user
      query = `
        SELECT session_id, user_id, created_at, updated_at, title
        FROM Chat_Session 
        WHERE user_id = $1 
        ORDER BY updated_at DESC
      `;
      params = [loggedInUserId];
    } else if (currentSessionId){
      // Not logged in but has a current session: show only that session
      query = `
        SELECT session_id, user_id, created_at, updated_at, title
        FROM Chat_Session 
        WHERE session_id = $1
      `;
      params = [currentSessionId];
    }else{
      // Return empty array
      return res.json([]);
    }
    
    const result = await pool.query(query, params);
    
    const sessions = result.rows.map(row => ({
      session_id: row.session_id,
      user_id: row.user_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      title: row.title
    }));
    
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
});





router.get('/papers', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
    const search = (req.query.search || '').trim().toLowerCase();
    const yearFilter = req.query.year ? String(req.query.year).trim() : null;

    const codesPath = path.join(__dirname, '..', 'webscrappers', 'paper_codes.txt');
    const dataPath = path.join(__dirname, '..', 'webscrappers', 'papers_data.json');

    let codesText = '';
    try { codesText = await fs.readFile(codesPath, 'utf8'); } catch (err) { codesText = ''; }
    const codes = codesText
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);

    let extra = {};
    try {
      const dat = await fs.readFile(dataPath, 'utf8');
      const parsed = JSON.parse(dat);

      if (Array.isArray(parsed)) {
        parsed.forEach(p => {
          if (!p) return;
          const key = (p.code || p.codeName || p.paper || '').toString().trim().toUpperCase();
          if (key) extra[key] = p;
        });
      } else if (parsed && typeof parsed === 'object') {
        Object.keys(parsed).forEach(k => {
          const key = String(k).trim().toUpperCase();
          if (key) extra[key] = parsed[k];
        });
        if (parsed.code) extra[String(parsed.code).trim().toUpperCase()] = parsed;
      }
    } catch (err) {
      extra = {};
    }

    const all = codes.map(code => {
      const clean = String(code || '').trim().toUpperCase();
      const matched = (clean.match(/\d+/) || [null])[0];
      const year = matched ? String(matched)[0] : null;
      const ed = extra[clean] || {};
      const title = ed.title || ed.name || ed.label || '';
      const description = ed.description || ed.summary || ed.desc || ed.abstract || '';
      const otagoLink = `https://www.otago.ac.nz/courses/papers?papercode=${encodeURIComponent(clean)}`;
      return {
        code: clean,
        title,
        description: description || 'No description available.',
        year,
        link: otagoLink
      };
    });

    let filtered = all;
    if (yearFilter) filtered = filtered.filter(p => String(p.year) === String(yearFilter));
    if (search) {
      filtered = filtered.filter(p =>
        (p.code || '').toLowerCase().includes(search) ||
        (p.title || '').toLowerCase().includes(search) ||
        (p.description || '').toLowerCase().includes(search)
      );
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    res.json({ total, page, pageSize, items });
  } catch (err) {
    console.error('GET /api/papers error:', err);
    res.status(500).json({ error: 'Failed to load papers' });
  }
});

// Delete account
router.post('/delete-account', async (req, res) => {
  if (!req || !req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  const userId = req.session.userId;
  try {
    // remove user row 
    await pool.query('DELETE FROM Web_User WHERE id = $1', [userId]);

    // destroy session and clear cookie
    req.session.destroy(err => {
      if (err) {
        console.error('Delete account - session destroy failed:', err);
        return res.status(500).json({ success: false, message: 'Account deleted but session could not be cleared' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Account deleted' });
    });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
});

router.post('/match', async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Not logged in' });

    const { paper_code } = req.body;
    if (!paper_code) return res.status(400).json({ success: false, message: 'Missing paper_code' });

    await pool.query(
      'INSERT INTO user_paper_matches (user_id, paper_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, paper_code]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving match:', err);
    res.status(500).json({ success: false, message: 'Failed to save match' });
  }
});

router.get('/my-matches', async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.json([]);

    const result = await pool.query(
      'SELECT paper_code, matched_at FROM user_paper_matches WHERE user_id = $1 ORDER BY matched_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching matches:', err);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});


// ensure both router and pool are exported for server.js to destructure
module.exports = { router, pool };
