import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { initDb } from './db.js';
import { initJira } from './jira.js';
import { setupRoutes } from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, "users.db");
const JIRA_BASE_URL = "https://collaboration.msi.audi.com/jira";

const startServer = async () => {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const configFile = await fs.readFile(configPath);
        const { JIRA_API_TOKEN } = JSON.parse(configFile);

        if (!JIRA_API_TOKEN || JIRA_API_TOKEN === "YOUR_JIRA_API_TOKEN_HERE") {
            throw new Error("JIRA_API_TOKEN is not set in config.json");
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