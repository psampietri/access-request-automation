import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { initDb } from './db.js';
import { initJira } from './jira.js';
import { setupRoutes } from './routes/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, "users.db");
const JIRA_BASE_URL = process.env.JIRA_BASE_URL; // <-- Use variable
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN; // <-- Use variable

const startServer = async () => {
    try {
        if (!JIRA_API_TOKEN) {
            throw new Error("JIRA_API_TOKEN is not set in the .env file");
        }
        if (!JIRA_BASE_URL) {
            throw new Error("JIRA_BASE_URL is not set in the .env file");
        }
        console.log(`✅ JIRA_API_TOKEN loaded successfully. Snippet: ...${JIRA_API_TOKEN.slice(-4)}`);

        initJira(JIRA_API_TOKEN, JIRA_BASE_URL);

        const db = await initDb(DB_FILE);
        console.log("✅ Successfully connected to local SQLite database.");

        const app = express();
        app.use(cors());
        app.use(express.json());

        setupRoutes(app, db, JIRA_BASE_URL);

        const PORT = process.env.PORT || 5001;
        app.listen(PORT, () => {
            console.log("======================================================");
            console.log(`🚀 Starting Node.js proxy server on http://127.0.0.1:${PORT}`);
            console.log("======================================================");
        });
    } catch (error) {
        console.error("❌ FATAL ERROR:", error.message);
        process.exit(1);
    }
};

startServer();