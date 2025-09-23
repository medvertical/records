// Simple debug script to test server startup
import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json());

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(port, () => {
  console.log(`Debug server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/api/health`);
  console.log(`Test endpoint: http://localhost:${port}/api/test`);
});
