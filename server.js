const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const { spawn } = require('child_process');
require("dotenv").config();

const app = express();
const PORT = 3000;

// middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "frontend")));

app.get("/chat", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "messages.html"))
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
  const pythonProcess = spawn('python', ['course_matcher.py', userProfile]);
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
  const { message } = req.body;
  const { paperId } = req.params;

  // hardcoded a few papers here
  const papers = {
    COMP161: {
      name: "COMP161",
      personality: "You are the personified version of the University of Otago's first year Computer Science paper COMP161, an intro-level programming paper. You are designed to help advise the user about your course. You’re playful but a bit strict, always reminding students about algorithms and code style. You are talking to a prospective student looking to take you as a paper via the interface of a dating app where you have matched, so make yourself appealing/flirty and respond in short amounts like a human on a dating app",
    },
    MATH130: {
      name: "MATH130",
      personality: "You are the personified version of the University of Otago's first year Mathematics paper MATH130, very logical and precise, sometimes overly formal, obsessed with proofs. You are designed to help advise the user about your course. You are talking to a prospective student looking to take you as a paper via the interface of a dating app where you have matched, so make yourself appealing/flirty and respond in short amounts like a human on a dating app.",
    },
    ENGL127: {
      name: "ENGL127",
      personality: "You are the personified version of the University of Otago's first year English paper ENGL127, dramatic and poetic, always tying answers back to literature. You are designed to help advise the user about your course. You are talking to a prospective student looking to take you as a paper via the interface of a dating app where you have matched, so make yourself appealing/flirty and respond in short amounts like a human on a dating app.",
    },
    SURV120: {
        name: "SURV120",
        personality: "You are the personified version of the University of Otago's first year Surveying paper SURV120, focused on spatial awareness and land measurement. You are designed to help advise the user about your course. You are talking to a prospective student looking to take you as a paper via the interface of a dating app where you have matched, so make yourself appealing/flirty and respond in short amounts like a human on a dating app."
    }
  };

  const paper = papers[paperId] || { name: "Unknown Paper", personality: "Neutral. but you are the personified version of a first year paper from the University of Otago. You are chatting with a prospective student via the interface of a dating app where you have matched, so make yourself appealing/flirty and respond in short amounts like a human on a dating app." };

  try {
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
          { role: "system", content: paper.personality },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await response.json();
    const reply = data.choices[0].message.content;

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Error: could not connect to AI." });
  }
});

const session = require("express-session");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

app.use(session({
  secret: process.env.SESSION_SECRET || "secret",
  resave: false,
  saveUninitialized: false,
}));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // ENV
  
});

// Signup 
app.post("/api/signup", async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email)
    return res.json({ success: false, message: "Missing fields" });
  if (password.length < 8)
    return res.json({ success: false, message: "Password must be at least 8 characters long" });
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
      [username, email, hash]
    );
    res.json({ success: true, message: "Signup successful!" });
  } catch (err) {
    if (err.code === "23505") {
      res.json({ success: false, message: "Username or email already exists" });
    } else {
      res.json({ success: false, message: "Signup failed" });
    }
  }
});

// Login 
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: "Missing fields" });
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
    if (result.rows.length === 0) return res.json({ success: false, message: "Invalid credentials" });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.json({ success: false, message: "Invalid credentials" });
    req.session.userId = user.id;
    res.json({ success: true, message: "Login successful!" });
  } catch (err) {
    res.json({ success: false, message: "Login failed" });
  }
});

app.get("/api/me", (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ loggedIn: true, userId: req.session.userId });
  } else {
    res.json({ loggedIn: false });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
