import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, "users.db");
const JIRA_BASE_URL = "https://collaboration.msi.audi.com/jira";

let db;
let JIRA_API_TOKEN;

const app = express();
app.use(cors());
app.use(express.json());

const callJiraApi = async (endpoint, method = 'GET', payload = null) => {
    const url = `${JIRA_BASE_URL}${endpoint}`;
    const headers = {
        'Authorization': `Bearer ${JIRA_API_TOKEN}`,
        'Content-Type': 'application/json'
    };
    try {
        const options = { method, headers };
        if (payload) {
            options.body = JSON.stringify(payload);
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `Jira API request failed with status ${response.status}` }));
            throw { status: response.status, data: errorData };
        }
        return response.status === 204 ? { success: true } : await response.json();
    } catch (error) {
        console.error(`Jira API Error: ${error.status || 'Network Error'}`, error.data || error);
        throw error;
    }
};

app.get('/jira/servicedesks', async (req, res) => res.json(await callJiraApi("/rest/servicedeskapi/servicedesk")));
app.get('/jira/servicedesks/:id/requesttypes', async (req, res) => res.json(await callJiraApi(`/rest/servicedeskapi/servicedesk/${req.params.id}/requesttype`)));
app.get('/jira/servicedesks/:sid/requesttypes/:rtid/fields', async (req, res) => res.json(await callJiraApi(`/rest/servicedeskapi/servicedesk/${req.params.sid}/requesttype/${req.params.rtid}/field`)));

app.get('/user-fields', async (req, res) => {
    const fields = await db.all("SELECT field_name FROM user_fields");
    res.json(fields.map(f => f.field_name));
});

app.get('/users', async (req, res) => {
    const users = await db.all('SELECT * FROM users ORDER BY Name, Surname');
    res.json(users);
});

app.post('/users', async (req, res) => {
    const userData = req.body;
    try {
        const fields = await db.all("SELECT field_name FROM user_fields");
        const fieldNames = fields.map(f => `"${f.field_name}"`);
        const placeholders = fields.map(() => '?').join(', ');
        const values = fields.map(f => userData[f.field_name]);
        
        await db.run(`INSERT INTO users (${fieldNames.join(', ')}) VALUES (${placeholders})`, values);
        res.status(201).json({ success: true, user: userData });
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT') {
            res.status(409).json({ error: "User with this email already exists" });
        } else {
            res.status(500).json({ error: "Failed to add user", details: e.message });
        }
    }
});

app.put('/users/:email', async (req, res) => {
    const userData = req.body;
    const userEmail = req.params.email;
    try {
        const fields = await db.all("SELECT field_name FROM user_fields WHERE field_name != 'E-mail'");
        const setClauses = fields.map(f => `"${f.field_name}" = ?`).join(', ');
        const values = fields.map(f => userData[f.field_name]);
        values.push(userEmail);
        
        await db.run(`UPDATE users SET ${setClauses} WHERE "E-mail" = ?`, values);
        res.json({ success: true, user: userData });
    } catch (e) {
        res.status(500).json({ error: "Failed to update user", details: e.message });
    }
});

app.delete('/users/:email', async (req, res) => {
    try {
        await db.run('DELETE FROM users WHERE "E-mail" = ?', req.params.email);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete user", details: e.message });
    }
});

app.get('/templates', async (req, res) => {
    const templates = await db.all('SELECT * FROM templates ORDER BY template_name');
    res.json(templates);
});

app.post('/templates', async (req, res) => {
    const data = req.body;
    try {
        await db.run(
            "INSERT INTO templates (template_name, service_desk_id, request_type_id, service_desk_name, request_type_name, field_mappings) VALUES (?, ?, ?, ?, ?, ?)",
            [data.template_name, data.service_desk_id, data.request_type_id, data.service_desk_name, data.request_type_name, JSON.stringify(data.field_mappings)]
        );
        res.status(201).json({ success: true });
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT') {
            res.status(409).json({ error: "A template with this name already exists." });
        } else {
            res.status(500).json({ error: "Failed to save template", details: e.message });
        }
    }
});

app.get('/requests', async (req, res) => {
    try {
        const ticketsToSync = await db.all("SELECT issue_key FROM requests WHERE closed_at IS NULL AND status != 'Deleted in Jira'");
        for (const row of ticketsToSync) {
            try {
                const issueData = await callJiraApi(`/rest/servicedeskapi/request/${row.issue_key}`);
                const status = issueData.currentStatus.status;
                if (issueData.currentStatus.statusCategory === 'DONE') {
                    const closedAt = issueData.currentStatus.statusDate.iso8601;
                    await db.run("UPDATE requests SET status = ?, closed_at = ? WHERE issue_key = ?", [status, closedAt, row.issue_key]);
                } else {
                    await db.run("UPDATE requests SET status = ? WHERE issue_key = ?", [status, row.issue_key]);
                }
            } catch (e) {
                if (e.status === 404) {
                    await db.run("UPDATE requests SET status = 'Deleted in Jira' WHERE issue_key = ?", [row.issue_key]);
                } else {
                    console.error(`SYNC_ERROR for ${row.issue_key}:`, e);
                }
            }
        }
    } catch (e) {
        console.error("SYNC_ERROR:", e);
    }
    const history = await db.all("SELECT * FROM requests ORDER BY opened_at DESC");
    res.json({ requests: history, jira_base_url: JIRA_BASE_URL });
});

app.get('/analytics/time_spent', async (req, res) => {
    try {
        const rows = await db.all("SELECT request_type_name, opened_at, closed_at FROM requests WHERE closed_at IS NOT NULL");
        const durations = {};
        for (const row of rows) {
            try {
                const openedDt = new Date(row.opened_at);
                const closedDt = new Date(row.closed_at);
                const durationHours = (closedDt - openedDt) / (1000 * 60 * 60);
                if (!durations[row.request_type_name]) {
                    durations[row.request_type_name] = [];
                }
                durations[row.request_type_name].push(durationHours);
            } catch (e) { }
        }
        const analyticsData = Object.entries(durations).map(([name, hourList]) => ({
            request_type_name: name,
            avg_hours: hourList.reduce((a, b) => a + b, 0) / hourList.length
        }));
        res.json(analyticsData);
    } catch (e) {
        res.status(500).json({ error: "Failed to calculate analytics" });
    }
});

app.get('/history', (req, res) => {
    db.all('SELECT * FROM history', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});
const startServer = async () => {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const configFile = await fs.readFile(configPath);
        JIRA_API_TOKEN = JSON.parse(configFile).JIRA_API_TOKEN;
        if (!JIRA_API_TOKEN || JIRA_API_TOKEN === "YOUR_JIRA_API_TOKEN_HERE") {
            throw new Error("JIRA_API_TOKEN is not set in config.json");
        }
        console.log(`✅ JIRA_API_TOKEN loaded successfully. Snippet: ...${JIRA_API_TOKEN.slice(-4)}`);

        db = await open({ filename: DB_FILE, driver: sqlite3.Database });
        console.log("✅ Successfully connected to local SQLite database.");

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