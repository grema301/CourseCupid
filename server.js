/** server.js */

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
require("dotenv").config();
const { spawn } = require("child_process");

const session = require("express-session"); 

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "frontend")));

// session middleware (add before mounting api routes)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
  })
);

// Mount API routes from api-server.js
const api = require('./db/api-server');
app.use('/api', api.router || api);


app.get("/chat", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "chat.html"))
);

app.get("/chat/:paperId", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "chat.html"))
);

app.get("/quiz", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "quiz.html"))
);

app.post("/api/quiz-recommendations", async (req, res) => {
  console.log("Received a request for course recommendations."); // ADDED
  const { answers } = req.body;
  const userProfile = answers.join(" ");
  console.log("User profile string:", userProfile); // ADDED

  // We are going to execute the Python script as a separate child process
  const pythonProcess = spawn('python', ['google_course_matcher.py', userProfile], {
      env: { ...process.env, GEMINI_API_KEY: process.env.GEMINI_API_KEY }
  });
  pythonProcess.on('error', (err) => {
      console.error(`Failed to start child process: ${err.message}`);
      res.status(500).json({ error: "Failed to start the recommendation service." });
  });

  let dataToSend = '';

  // Listen for data from the python script
  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python script output: ${data.toString()}`); // ADDED
    dataToSend += data.toString();
  });

  // Listen for errors from the python script
  pythonProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  // When the Python process exits
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

// handle chat requests
app.post("/api/chat/:paperId", async (req, res) => {
  const paperId = req.params.paperId;
  const message = req.body.message;

  const userId = req.session?.userId || null;


  console.log(`Chat request for paper ID: ${paperId} with message: ${message}`);

  // Check if it's a session ID
  const isSessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paperId);
  
  /*   //shouldn't happen as api-server.js handles sessions aye?
  if (isSessionId) {
    // Handle session-based chat
    try {
      const sessionCheck = await pool.query(
        'SELECT session_id FROM Chat_Session WHERE session_id = $1', 
        [paperId]
      );
      
      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({ reply: "Error: Session not found." });
      }
      
      // For now, simple Cupid response - implement AI later
      const reply = "I'm Cupid! I'm here to help you find your perfect course match. What would you like to know about courses or your academic journey?";
      res.json({ reply });
      
    } catch (error) {
      console.error('Session chat error:', error);
      res.status(500).json({ reply: "Error: could not process chat." });
    }
    
    return;
  }*/

  try {
    //get the paper code we're talking to
    const result = await pool.query('SELECT * FROM paper WHERE paper_code = $1', [paperId]);
    const paperData = result.rows[0];

    console.log("Fetched paper data:", paperData);

    if (!paperData) {
      return res.status(404).json({ reply: "Error: Paper not found." });
    }

    // Get/create session for this paper chat
    let sessionResult = await pool.query(
      `SELECT session_id FROM Chat_Session 
       WHERE user_id = $1 AND paper_code = $2 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, paperId]
    );
    

    let sessionId;
    const now = new Date(); 
    const { v4: uuidv4 } = require('uuid');


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
      sessionId = sessionResult.rows[0].session_id;
      // Update the session's updated_at timestamp
      await pool.query(
        'UPDATE Chat_Session SET updated_at = $1 WHERE session_id = $2',
        [now, sessionId]
      );
    }

    // Store user message
    const userMessageId = uuidv4();
    await pool.query(
      `INSERT INTO Chat_Message (message_id, session_id, role, content, created_at, user_preferences) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userMessageId, sessionId, 'user', message, now, null]
    );
    console.log(`Stored user message in session ${sessionId}`);



    // Generate AI response
    const prompt = `You are ${paperData.title} (${paperData.paper_code}), a first-year university paper from the University of Otago. Description: ${paperData.description}.
    You are on a dating app, trying to convince a prospective student to take you as a paper.
    You are playful and flirty, but also informative about your course content and structure.
    Answer the user's questions in short, engaging responses.`;

    console.log(`Generated prompt for paper ID ${paperId}: ${prompt}`);

    
    // groq API call
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct", // model
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await response.json();
    const reply = data.choices[0].message.content;

    // Store AI reply
    const assistantMessageId = uuidv4();
    await pool.query(
      `INSERT INTO Chat_Message (message_id, session_id, role, content, created_at, user_preferences) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [assistantMessageId, sessionId, 'assistant', reply, new Date(), null]
    );
    console.log(`Stored AI reply in session ${sessionId}`);


    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Error: could not connect to AI." });
  }
});


/**Dynamic SessiondID handling
app.get("/api/chat/:sessionID", async (req, res) => {
  const sessionID = req.params.sessionID;
    
    try {
      //Validate that the session exists in database
      const sessionCheck = await pool.query(
        'SELECT session_id FROM Chat_Session WHERE session_id = $1 ORDER BY created_at DESC', 
        [sessionID] 
      );
      
      if (sessionCheck.rows.length === 0) {
        return res.status(404).send('Chat session not found');
      }
      
      //Serve chat HTML page
      res.sendFile(path.join(__dirname, 'frontend', 'chat.html'));

    } catch (error) {
      console.error('Error loading chat session:', error);
      res.status(500).send('Error loading chat session');
    }
});*/


app.get('/imported_papers.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'imported_papers.json'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
