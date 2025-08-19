const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 5000;

// Serve frontend static files from /frontend
app.use('/', express.static(path.join(__dirname, 'frontend')));

// Serve backend static files (for development/demo) under /backend
app.use('/backend', express.static(path.join(__dirname, 'backend')));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
