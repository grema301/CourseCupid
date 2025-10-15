/** 
 * server.js - Course Cupid Main Server
 * Express server handling routes, sessions, and paper chat AI
 * */

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session"); 
const { v4: uuidv4 } = require('uuid');
const { spawn } = require("child_process");
require("dotenv").config();

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "frontend")));

// Session middleware - must be set up before mounting API routes
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
  })
);

const { router: apiRouter, pool: apiPool } = require("./db/api-server");
const { Pool } = require("pg");

// Use pool from api-server or create fallback
const pool = apiPool || new Pool();

// Use pool from api-server or create fallback
app.use("/api", apiRouter);

/**
 * GET /chat
 * Serves the main chat interface (empty state)
 */
app.get("/chat", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "chat.html"))
);

/**
 * GET /chat/:identifier
 * Serves chat interface for a specific paper or session
 * Identifier can be either a paper code (e.g., COMP161) or session UUID
 */
app.get("/chat/:identifier", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "chat.html"))
);

/**
 * GET /quiz
 * Serves the course recommendation quiz page
 */
app.get("/quiz", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "quiz.html"))
);

/**
 * GET /imported_papers.json
 * Serves static JSON file containing paper data
 */
app.get('/imported_papers.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'imported_papers.json'));
});

/**
 * POST /api/quiz-recommendations
 * Processes quiz answers and returns AI-generated course recommendations
 * Uses Python script with Google Gemini API
 */
app.post("/api/quiz-recommendations", async (req, res) => {
  console.log("Received a request for course recommendations.");
  const { answers } = req.body;

  // Combine user answers into a single profile string
  const userProfile = answers.join(" ");
  console.log("User profile string:", userProfile);

  // Spawn Python child process to run AI recommendation script
  const pythonProcess = spawn('python', ['google_course_matcher.py', userProfile], {
      env: { ...process.env, GEMINI_API_KEY: process.env.GEMINI_API_KEY }
  });

  // Handle process startup errors
  pythonProcess.on('error', (err) => {
      console.error(`Failed to start child process: ${err.message}`);
      res.status(500).json({ error: "Failed to start the recommendation service." });
  });

  let dataToSend = '';

  // Collect output from Python script
  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python script output: ${data.toString()}`); // ADDED
    dataToSend += data.toString();
  });

  // Log any errors from Python script
  pythonProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  // Process results when Python script finishes
  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`); // ADDED
    if (code === 0) {
      try {
        const recommendations = JSON.parse(dataToSend);
        console.log("Recommendations parsed successfully."); // ADDED
        res.json({ recommendedCourses: recommendations });
      } catch (e) {
        console.error("Failed to parse JSON from Python script:", e);
        res.status(500).json({ error: "Invalid response from the server." });
      }
    } else {
      console.error(`Python script exited with code ${code}`);
      res.status(500).json({ error: "Failed to get course recommendations." });
    }
  });
});

/**
 * POST /api/chat/:paperId
 * Handles AI chat conversations with individual papers
 * Creates/updates chat sessions and stores message history
 * Note: Cupid session chats are handled by api-server.js
 */
app.post("/api/chat/:paperId", async (req, res) => {
  const paperId = req.params.paperId;
  const message = req.body.message;
  const userId = req.session?.userId || null;

  console.log(`Chat request for paper ID: ${paperId} with message: ${message}`);

  try {
    // Fetch paper data from database
    const result = await pool.query('SELECT * FROM paper WHERE paper_code = $1', [paperId]);
    const paperData = result.rows[0];

    console.log("Fetched paper data:", paperData);

    if (!paperData) {
      return res.status(404).json({ reply: "Error: Paper not found." });
    }

    // Get or create chat session for this paper
    let sessionResult = await pool.query(
      `SELECT session_id FROM Chat_Session 
       WHERE user_id = $1 AND paper_code = $2 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, paperId]
    );
    

    let sessionId;
    const now = new Date(); 


    if (sessionResult.rows.length === 0) {
      // Create new session for this paper
      sessionId = uuidv4();
      await pool.query(
        `INSERT INTO Chat_Session (session_id, user_id, paper_code, created_at, updated_at, starred) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sessionId, userId, paperId, now, now, false]
      );
      console.log(`Created new session ${sessionId} for paper ${paperId}`);
    } else {
      // Use existing session and update timestamp
      sessionId = sessionResult.rows[0].session_id;
      await pool.query(
        'UPDATE Chat_Session SET updated_at = $1 WHERE session_id = $2',
        [now, sessionId]
      );
    }

    // Store user message in database
    const userMessageId = uuidv4();
    await pool.query(
      `INSERT INTO Chat_Message (message_id, session_id, role, content, created_at, user_preferences) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userMessageId, sessionId, 'user', message, now, null]
    );
    console.log(`Stored user message in session ${sessionId}`);

    // Build AI personality prompt for this paper
    const prompt = `You are ${paperData.title} (${paperData.paper_code}), a first-year university paper from the University of Otago. Description: ${paperData.description}.
    You are on a dating app, trying to convince a prospective student to take you as a paper.
    You are playful and flirty, but also informative about your course content and structure.
    Answer the user's questions in short, engaging responses.`;

    console.log(`Generated prompt for paper ID ${paperId}: ${prompt}`);

    // Retrieve recent conversation history for context
    const histRes = await pool.query(
      `SELECT role, content
       FROM Chat_Message
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 8`,
      [sessionId]
    );

    // Format conversation history for AI (most recent first, then reverse)
    const recent = histRes.rows
      .filter(r => r && r.content && (r.role === 'user' || r.role === 'assistant'))
      .reverse() 
      .map(r => ({ 
        role: r.role, 
        content: r.content 
      }));

    // Prepare messages for AI API call
    const messages = [
      { role: "system", content: prompt },
      ...recent
    ];

    // Call Groq AI API for response
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages
      }),
    });

    const data = await response.json();
    const reply = data.choices[0].message.content;

    // Store AI reply in database
    const assistantMessageId = uuidv4();
    await pool.query(
      `INSERT INTO Chat_Message (message_id, session_id, role, content, created_at, user_preferences) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [assistantMessageId, sessionId, 'assistant', reply, new Date(), null]
    );

    console.log(`Stored AI reply in session ${sessionId}`);

    // Send reply to frontend
    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      reply: "Error: could not connect to AI." 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
