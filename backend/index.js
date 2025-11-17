const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Simple in-memory profile
let profile = {
  name: 'Demo User',
  age: 25,
  goal: 'Lose fat',
};

// GET /profile
app.get('/profile', (req, res) => {
  res.json(profile);
});

// POST /profile
app.post('/profile', (req, res) => {
  const { name, age, goal } = req.body;
  profile = { name, age, goal };
  console.log('Updated profile:', profile);
  res.json(profile);
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});//
mm
