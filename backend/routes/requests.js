import { getJiraIssueDetails } from '../jira.js';

export const requestsRoutes = (app, db, JIRA_BASE_URL) => {
    app.get('/requests', async (req, res) => {
        try {
            const ticketsToSync = await db.all("SELECT issue_key FROM requests WHERE closed_at IS NULL AND status != 'Deleted in Jira'");
            for (const row of ticketsToSync) {
                try {
                    const issueData = await getJiraIssueDetails(row.issue_key);
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

    app.post('/requests/manual', async (req, res) => {
        const { issue_keys } = req.body;
        const success = [];
        const failed = [];

        for (const key of issue_keys) {
            try {
                const existing = await db.get('SELECT * FROM requests WHERE issue_key = ?', key);
                if (existing) {
                    failed.push({ key, reason: 'Already tracked' });
                    continue;
                }
                const issueData = await getJiraIssueDetails(key);

                const requestTypeName = issueData?.requestType?.name || 'N/A';
                const currentStatus = issueData?.currentStatus?.status || 'N/A';
                const createdDate = issueData?.createdDate?.iso8601 || new Date().toISOString();

                await db.run(
                    'INSERT INTO requests (issue_key, user_email, request_type_name, status, opened_at) VALUES (?, ?, ?, ?, ?)',
                    [
                        issueData.issueKey,
                        'N/A', // Manual entry might not have a user initially
                        requestTypeName,
                        currentStatus,
                        createdDate
                    ]
                );
                success.push(key);
            } catch (error) {
                failed.push({ key, reason: error.message || 'Failed to fetch from Jira' });
            }
        }
        res.json({ success, failed });
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

    app.delete('/requests/:issue_key', async (req, res) => {
        const { issue_key } = req.params;
        try {
            await db.run('DELETE FROM requests WHERE issue_key = ?', [issue_key]);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'Failed to delete request', details: e.message });
        }
    });
};