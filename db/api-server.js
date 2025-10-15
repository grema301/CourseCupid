/** api-server.js */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const router = express.Router();
router.use(express.json()); 
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
let nodemailer;
try { nodemailer = require('nodemailer'); } catch { nodemailer = null; console.warn('nodemailer not installed — email sending disabled'); }

router.use(cors());

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


// Handle chat messages, handles both sessions and papers
// If identifier is a UUID (session), handles it here. Otherwise calls next() 
// to pass paper chats to server.js where the paper AI is implemented.
router.post('/chat/:identifier', async (req, res, next) => {
  const identifier = req.params.identifier;
  const message = req.body.message;
  
  // Check if it's a session ID (UUID pattern)
  const isSessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  if (!isSessionId) {
    return next();// Not a session ID, pass to server.js to handle paper AI chat
  }

  try {

    // Validate session exists
    const sessionCheck = await pool.query(
      'SELECT session_id FROM Chat_Session WHERE session_id = $1', 
      [identifier]
    );
    
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ reply: "Error: Session not found." });
    }

    const now = new Date();


    //Save the user message
    const userMessageId = uuidv4();
    await pool.query(`
      INSERT INTO Chat_Message (message_id, session_id, role, content, created_at, user_preferences)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userMessageId, identifier, 'user', message, now, null]);


    //Placeholder reply
    const reply = "Hello! I'm Cupid! How can I help you?";


    //Save the assistant reply
    const assistantMessageId = uuidv4();
    await pool.query(`
      INSERT INTO Chat_Message (message_id, session_id, role, content, created_at, user_preferences)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [assistantMessageId, identifier, 'assistant', reply, now, null]);


    //Send reply
    return res.json({ reply: reply });

  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to handle chat message" });
  }

});





// Handle session-based chat messages (match frontend expectations)
router.get('/chat/:identifier/messages', async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const userId = req.session?.userId || null;

    
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
      

      // Get messages for this session
      const messages = await pool.query(
        `SELECT message_id, session_id, role as sender, content, created_at, user_preferences
         FROM Chat_Message 
         WHERE session_id = $1 
         ORDER BY created_at ASC`,
        [identifier]
      );
      
      // Transform to match frontend expectations
      const formattedMessages = messages.rows.map(msg => ({
        sender: msg.sender, // 'user' or 'assistant'
        content: msg.content,
        created_at: msg.created_at,
        message_id: msg.message_id
      }));

      // Return empty array for now, implement message storage later)
      return res.json(formattedMessages);

    } else {

      // Paper code - get messages by finding the session for this paper
      const sessionResult = await pool.query(
        `SELECT session_id FROM Chat_Session 
         WHERE (user_id = $1 OR (user_id IS NULL AND $1 IS NULL)) AND paper_code = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [userId, identifier]
      );

      // It's a paper code don't validate as UUID, just return empty for now
      // TODO: Implement paper message history from database
      if (sessionResult.rows.length === 0) {
        return res.json([]);
      }

      const sessionId = sessionResult.rows[0].session_id;

      // Get messages for this session
      const messages = await pool.query(
        `SELECT message_id, session_id, role as sender, content, created_at, user_preferences
         FROM Chat_Message 
         WHERE session_id = $1 
         ORDER BY created_at ASC`,
        [sessionId]
      );

      // Transform to match frontend expectations
      const formattedMessages = messages.rows.map(msg => ({
        sender: msg.sender, // 'user' or 'assistant'
        content: msg.content,
        created_at: msg.created_at,
        message_id: msg.message_id
      }));
      
      return res.json(formattedMessages);

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
    const userId = req.session?.userId || null;


    if (isSessionId) {
      const sessionCheck = await pool.query(
        'SELECT session_id FROM Chat_Session WHERE session_id = $1', 
        [identifier]
      );
      
      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }


      const messages = await pool.query(
        `SELECT message_id, session_id, role as sender, content, created_at
         FROM Chat_Message 
         WHERE session_id = $1 
         ORDER BY created_at ASC`,
        [identifier]
      );


      
      return res.json(messages.rows.map(msg => ({
        sender: msg.sender,
        content: msg.content,
        created_at: msg.created_at
      })));


    } else { //Paper code

      const sessionResult = await pool.query(
        `SELECT session_id FROM Chat_Session 
         WHERE user_id = $1 AND paper_code = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [userId, identifier]
      );
      
      if (sessionResult.rows.length === 0) {
        return res.json([]);
      }
      
      const messages = await pool.query(
        `SELECT message_id, session_id, role as sender, content, created_at
         FROM Chat_Message 
         WHERE session_id = $1 
         ORDER BY created_at ASC`,
        [sessionResult.rows[0].session_id]
      );



      return res.json(msg => ({
        sender: msg.sender,
        content: msg.content,
        created_at: msg.created_at
      }));
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
    const userId = req.session?.userId || null;

    if (isSessionId) {
      const sessionCheck = await pool.query(
        'SELECT session_id FROM Chat_Session WHERE session_id = $1', 
        [identifier]
      );
      
      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const reply = "Hi there! This is a cupid chat";

      // Store the first message
      const messageId = uuidv4();
      const now = new Date();
      await pool.query(
        `INSERT INTO Chat_Message (message_id, session_id, role, content, created_at, user_preferences) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [messageId, identifier, 'assistant', reply, now, null]
      );
      
      return res.json({reply});
    } else {

      // Paper-based first message - check if session exists
      const sessionResult = await pool.query(
        `SELECT session_id FROM Chat_Session 
         WHERE user_id = $1 AND paper_code = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [userId, identifier]
      );
      
      if (sessionResult.rows.length === 0) {
        // No first message needed, let server.js handle it
        return res.json({ reply: "" });
      }
      
      // Check if there are already messages
      const messageCheck = await pool.query(
        'SELECT COUNT(*) as count FROM Chat_Message WHERE session_id = $1',
        [sessionResult.rows[0].session_id]
      );
      
      if (parseInt(messageCheck.rows[0].count) > 0) {
        return res.json({ reply: "" }); // Already has messages
      }

      //Handle paper-based first messages
      return res.json({ reply: "" });
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
        session_id, user_id, paper_code, created_at, updated_at, starred
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING session_id, user_id
    `, [session_ID, userId, null, now, now, false]); // null for anonymous users

    res.json({
      session_id: result.rows[0].session_id,
      is_anonymous: result.rows[0].user_id === null
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});


// Handles deleting a cupid chat session, and a paper match session 
router.delete('/chat-sessions/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;

    // See if user is logged in
    const userId = req.session?.userId || null;

    // Check if its a UUID chat session, or a Paper chat
    const isSessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    if (isSessionId){ // Delete a cupid chat session

      //Delete the messages before the session
      await pool.query('DELETE FROM Chat_Message WHERE session_id = $1', [identifier]); 
      const result = await pool.query('DELETE FROM Chat_Session WHERE session_id = $1 RETURNING session_id', [identifier]);

      //await pool.query('DELETE FROM Chat_Session WHERE session_id = $1', [identifier]);


      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Session not found' });
      }
      
      console.log(`Deleted Cupid session ${identifier} and its messages`);
    

    }else{ // Delete a paper match chat session

      // get chat session for specific user, for specific paper
      const sessionResult = await pool.query(
        'SELECT session_id FROM Chat_Session WHERE user_id = $1 AND paper_code = $2',
        [userId, identifier]
      );


      if (sessionResult.rows.length > 0){
        const sessionId = sessionResult.rows[0].session_id;
        
        // Delete messages for this session
        await pool.query('DELETE FROM Chat_Message WHERE session_id = $1', [sessionId]);
        
        // Delete the session
        await pool.query('DELETE FROM Chat_Session WHERE session_id = $1', [sessionId]);
        
        console.log(`Deleted paper session ${sessionId} for paper ${identifier}`);
      }

      // Delete the match
      await pool.query('DELETE FROM user_paper_matches WHERE user_id = $1 AND paper_code = $2;', [userId, identifier]);
      console.log(`Deleted paper match ${identifier} for user ${userId}`);
    }

    res.json({ 
      success: true, message: 'Session deleted successfully', identifier: identifier
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
        WHERE user_id = $1 AND paper_code IS NULL
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

// Get a single chat session by ID
router.get('/chat-sessions/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const userId = req.session?.userId || null;
    
    // Check if it's a UUID (session ID)
    const isSessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    if (!isSessionId) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }
    
    // For logged-in users, verify they own session
    // For anon users, allow access to any session through URL (should change later)
    let query, params;
    if (userId) {
      query = 'SELECT session_id, user_id, created_at, updated_at, title FROM Chat_Session WHERE session_id = $1 AND user_id = $2';
      params = [identifier, userId];
    } else {
      query = 'SELECT session_id, user_id, created_at, updated_at, title FROM Chat_Session WHERE session_id = $1';
      params = [identifier];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Return the session object for openCupidChat() to use
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching chat session:', error);
    res.status(500).json({ error: 'Failed to fetch chat session' });
  }
});




// Update chat title
router.put('/chat-sessions/:id/title', async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid title' });
  }

  try {
    await pool.query(
      `UPDATE Chat_Session SET title = $1, updated_at = NOW() WHERE session_id = $2`,
      [title.trim(), id]
    );
    res.json({ success: true, title: title.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update chat title' });
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

let _tx;
function getMailer() {
  if (_tx) return _tx;
  if (!nodemailer) return null;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  _tx = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT || 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  return _tx;
}

router.post('/contact', async (req, res) => {
  try {
    const { name = '', email = '', message = '' } = req.body || {};
    const fromEmail = String(email).trim();
    const body = String(message).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail) || !body) {
      return res.status(400).json({ error: 'Valid email and message required' });
    }
    const tx = getMailer();
    if (!tx) return res.status(500).json({ error: 'Email not configured' });

    const supportTo = 'coursecupid@gmail.com';
    const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER;

    await tx.sendMail({
      from: fromAddr,
      to: supportTo,
      replyTo: fromEmail,
      subject: `Contact — ${name || fromEmail}`,
      text: `Name: ${name || '(not provided)'}\nEmail: ${fromEmail}\n\n${body}`
    });

    await tx.sendMail({
      from: fromAddr,
      to: fromEmail,
      subject: 'Course Cupid — We received your message',
      text: `Hi${name ? ' ' + name : ''},\n\nThanks for contacting Course Cupid. We’ve received your message and will get back to you soon.\n\n— Course Cupid`
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('contact error:', err);
    return res.status(500).json({ error: 'server error' });
  }
});



// ensure both router and pool are exported for server.js to destructure
module.exports = { router, pool };

(async function ensurePasswordResetsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'password_resets' AND column_name = 'user_id' AND data_type <> 'text'
        ) THEN
          ALTER TABLE password_resets
          ALTER COLUMN user_id TYPE TEXT USING user_id::text;
        END IF;
      END$$;
    `);
  } catch (err) {
    console.error('Failed to ensure password_resets table:', err);
  }
})();

let RESOLVED_USER_TABLE;
async function getUserTable() {
  if (RESOLVED_USER_TABLE) return RESOLVED_USER_TABLE;
  try {
    const r = await pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE lower(table_name) = 'web_user'
      ORDER BY CASE WHEN table_schema = current_schema() THEN 0 ELSE 1 END
      LIMIT 1
    `);
    if (r.rowCount > 0) {
      const { table_schema, table_name } = r.rows[0];
      RESOLVED_USER_TABLE = `"${table_schema}"."${table_name}"`; 
    } else {
      RESOLVED_USER_TABLE = 'Web_User';
    }
  } catch {
    RESOLVED_USER_TABLE = 'Web_User';
  }
  return RESOLVED_USER_TABLE;
}

router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });

    const userTable = await getUserTable();
    const u = await pool.query(`SELECT user_id, email FROM ${userTable} WHERE email = $1 LIMIT 1`, [email]);

    if (u.rowCount > 0) {
      const user = u.rows[0];
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); 

      await pool.query(
        'INSERT INTO password_resets (token, user_id, expires_at) VALUES ($1, $2, $3)',
        [token, String(user.user_id), expiresAt]
      );

      const resetLink = `${req.protocol}://${req.get('host')}/reset.html?token=${encodeURIComponent(token)}`;

      const tx = getMailer && getMailer();
      if (tx) {
        tx.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: user.email,
          subject: 'Course Cupid — Password reset',
          text: `Use this link to reset your password (valid 1 hour): ${resetLink}`,
          html: `<p>Use this link to reset your password (valid 1 hour):</p><p><a href="${resetLink}">${resetLink}</a></p>`
        }).catch(err => console.warn('Reset email send failed:', err.message));
      } else {
        console.warn('SMTP not configured — reset email not sent');
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('request-password-reset error:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Apply new password using token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const { password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'token and password required' });

    const r = await pool.query('SELECT user_id, expires_at FROM password_resets WHERE token = $1 LIMIT 1', [token]);
    if (r.rowCount === 0) return res.status(400).json({ error: 'Invalid or expired token' });

    const row = r.rows[0];
    if (new Date(row.expires_at) < new Date()) {
      await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);
      return res.status(400).json({ error: 'Token expired' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const userTable = await getUserTable();
    await pool.query(`UPDATE ${userTable} SET password_hash = $1 WHERE user_id = $2`, [hashed, String(row.user_id)]);
    await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);

    return res.json({ success: true });
  } catch (err) {
    console.error('reset-password error:', err);
    return res.status(500).json({ error: 'server error' });
  }
});
