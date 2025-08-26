
const express = require('express');
const cors = require('cors');//
const {Client} = require('pg');

const app = express();
app.use(cors());
app.use(express.json());


const client = new Client({//Connecting to database
  host: "isdb.uod.otago.ac.nz",
  user: "hogka652",
  port: 5432,
  password: "mee3jai4waed", 
  database: "cosc345"
});


client.connect()
  .then(() => console.log('Database connected'))
  .catch(err => console.error('Database error:', err));




app.get('/api/test', async (req, res) => {
  try {
    const result = await client.query('SELECT NOW()');
    res.json({ message: 'API working!', time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


//Get user query
app.get('/api/users', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM Web_User');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


//Chat endpoint, basic
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    const response = `You said: "${message}". I'm course cupid!`;
    
    res.json({ 
      userMessage: message,
      botResponse: response 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//API server on port 3001 
app.listen(3001, () => {
  console.log('API server running on http://localhost:3001');
  console.log('Website on http://localhost:3000');
  console.log('Test API http://localhost:3001/api/test');
});



/* Inspect -> Console -> Paste each test
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