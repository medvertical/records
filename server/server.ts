import 'dotenv/config';
import express from "express";
import { registerRoutes } from "./routes/index.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Register routes
registerRoutes(app);

export { app };
