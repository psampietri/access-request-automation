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

app.get('/analytics/time_spent', async (req, res) => {
    try {
        const analyticsData = await db.all(`
            SELECT
                request_type_name,
                AVG(CAST(strftime('%s', substr(closed_at, 1, 19)) - strftime('%s', substr(opened_at, 1, 19)) AS REAL)) / 3600 AS avg_hours
            FROM requests
            WHERE closed_at IS NOT NULL
            GROUP BY request_type_name
        `);
        res.json(analyticsData);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch analytics data", details: e.message });
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

app.put('/requests/:issue_key/assign', async (req, res) => {
    const { issue_key } = req.params;
    const { user_email } = req.body;
    if (!user_email) {
        return res.status(400).json({ error: "User email is required." });
    }
    try {
        const result = await db.run(
            'UPDATE requests SET user_email = ? WHERE issue_key = ?',
            [user_email, issue_key]
        );
        if (result.changes === 0) {
            return res.status(404).json({ error: "Issue key not found." });
        }
        res.json({ success: true, issue_key, assigned_to: user_email });
    } catch (e) {
        res.status(500).json({ error: "Failed to assign user", details: e.message });
    }
});

// --- Onboarding Endpoints ---

app.get('/onboarding/templates', async (req, res) => {
    const onboardingTemplates = await db.all('SELECT * FROM onboarding_templates');
    for (const ot of onboardingTemplates) {
        const includedTemplates = await db.all(`
            SELECT t.template_id, t.template_name 
            FROM templates t
            JOIN onboarding_template_access_templates otat ON t.template_id = otat.template_id
            WHERE otat.onboarding_template_id = ?
        `, [ot.id]);
        ot.template_ids = includedTemplates.map(t => t.template_id);
        ot.template_names = includedTemplates.map(t => t.template_name);
    }
    res.json(onboardingTemplates);
});

app.post('/onboarding/templates', async (req, res) => {
    const { name, template_ids } = req.body;
    try {
        const result = await db.run('INSERT INTO onboarding_templates (name) VALUES (?)', [name]);
        const onboardingTemplateId = result.lastID;
        for (const templateId of template_ids) {
            await db.run('INSERT INTO onboarding_template_access_templates (onboarding_template_id, template_id) VALUES (?, ?)', [onboardingTemplateId, templateId]);
        }
        res.status(201).json({ success: true, id: onboardingTemplateId });
    } catch (e) {
        res.status(500).json({ error: 'Failed to create onboarding template', details: e.message });
    }
});

app.put('/onboarding/templates/:id', async (req, res) => {
    const { id } = req.params;
    const { name, template_ids } = req.body;
    try {
        await db.run('UPDATE onboarding_templates SET name = ? WHERE id = ?', [name, id]);
        await db.run('DELETE FROM onboarding_template_access_templates WHERE onboarding_template_id = ?', [id]);
        for (const templateId of template_ids) {
            await db.run('INSERT INTO onboarding_template_access_templates (onboarding_template_id, template_id) VALUES (?, ?)', [id, templateId]);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update onboarding template', details: e.message });
    }
});

app.delete('/onboarding/templates/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.run('DELETE FROM onboarding_template_access_templates WHERE onboarding_template_id = ?', [id]);
        await db.run('DELETE FROM onboarding_templates WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete onboarding template', details: e.message });
    }
});


app.get('/onboarding/instances', async (req, res) => {
    const instances = await db.all(`
        SELECT i.*, ot.name as onboarding_template_name
        FROM onboarding_instances i
        JOIN onboarding_templates ot ON i.onboarding_template_id = ot.id
    `);
    for (const inst of instances) {
        const statuses = await db.all(`
            SELECT ois.template_id, ois.status, ois.issue_key, t.template_name
            FROM onboarding_instance_statuses ois
            JOIN templates t ON ois.template_id = t.template_id
            WHERE ois.onboarding_instance_id = ?
        `, [inst.id]);
        inst.statuses = statuses;
    }
    res.json(instances);
});

app.post('/onboarding/instances', async (req, res) => {
    const { user_email, onboarding_template_id } = req.body;
    try {
        const result = await db.run('INSERT INTO onboarding_instances (user_email, onboarding_template_id) VALUES (?, ?)', [user_email, onboarding_template_id]);
        const instanceId = result.lastID;
        const templateIds = await db.all('SELECT template_id FROM onboarding_template_access_templates WHERE onboarding_template_id = ?', [onboarding_template_id]);
        for (const row of templateIds) {
            await db.run('INSERT INTO onboarding_instance_statuses (onboarding_instance_id, template_id) VALUES (?, ?)', [instanceId, row.template_id]);
        }
        res.status(201).json({ success: true, id: instanceId });
    } catch (e) {
        res.status(500).json({ error: 'Failed to initiate onboarding', details: e.message });
    }
});

app.delete('/onboarding/instances/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const statuses = await db.all('SELECT issue_key FROM onboarding_instance_statuses WHERE onboarding_instance_id = ?', [id]);
        if (statuses.some(s => s.issue_key !== null)) {
            return res.status(400).json({ error: 'Cannot delete onboarding instance with submitted tickets.' });
        }
        await db.run('DELETE FROM onboarding_instance_statuses WHERE onboarding_instance_id = ?', [id]);
        await db.run('DELETE FROM onboarding_instances WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete onboarding instance', details: e.message });
    }
});

app.post('/onboarding/instances/:instance_id/execute/:template_id', async (req, res) => {
    const { instance_id, template_id } = req.params;
    try {
        const instance = await db.get('SELECT user_email FROM onboarding_instances WHERE id = ?', [instance_id]);
        const user = await db.get('SELECT * FROM users WHERE "E-mail" = ?', [instance.user_email]);
        const template = await db.get('SELECT * FROM templates WHERE template_id = ?', [template_id]);
        const fieldMappings = JSON.parse(template.field_mappings);

        const requestData = {
            serviceDeskId: template.service_desk_id,
            requestTypeId: template.request_type_id,
            requestFieldValues: {}
        };

        for (const [fieldId, mapping] of Object.entries(fieldMappings)) {
            if (mapping.type === 'dynamic') {
                requestData.requestFieldValues[fieldId] = user[mapping.value];
            } else {
                requestData.requestFieldValues[fieldId] = mapping.value;
            }
        }

        const jiraResponse = await callJiraApi('/rest/servicedeskapi/request', 'POST', requestData);
        await db.run(
            'UPDATE onboarding_instance_statuses SET status = ?, issue_key = ? WHERE onboarding_instance_id = ? AND template_id = ?',
            [jiraResponse.currentStatus.status, jiraResponse.issueKey, instance_id, template_id]
        );
        
        await db.run(
            `INSERT INTO requests (issue_key, user_email, request_type_name, status, opened_at) VALUES (?, ?, ?, ?, ?)`,
            [jiraResponse.issueKey, user['E-mail'], template.request_type_name, jiraResponse.currentStatus.status, new Date().toISOString()]
        );
        
        res.json({ success: true, issueKey: jiraResponse.issueKey });
    } catch (error) {
        res.status(500).json({ error: 'Failed to execute request', details: error.message });
    }
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
        await db.exec(`
            CREATE TABLE IF NOT EXISTS onboarding_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS onboarding_template_access_templates (
                onboarding_template_id INTEGER,
                template_id INTEGER,
                FOREIGN KEY(onboarding_template_id) REFERENCES onboarding_templates(id),
                FOREIGN KEY(template_id) REFERENCES templates(template_id)
            );
            CREATE TABLE IF NOT EXISTS onboarding_instances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT,
                onboarding_template_id INTEGER,
                FOREIGN KEY(user_email) REFERENCES users("E-mail"),
                FOREIGN KEY(onboarding_template_id) REFERENCES onboarding_templates(id)
            );
            CREATE TABLE IF NOT EXISTS onboarding_instance_statuses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                onboarding_instance_id INTEGER,
                template_id INTEGER,
                status TEXT DEFAULT 'Not Started',
                issue_key TEXT,
                FOREIGN KEY(onboarding_instance_id) REFERENCES onboarding_instances(id),
                FOREIGN KEY(template_id) REFERENCES templates(template_id)
            );
        `);
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