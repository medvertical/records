import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/test', (req, res) => {
  res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.json({ message: 'Catch-all route', path: req.path });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Test server running on port ${port}`);
});
