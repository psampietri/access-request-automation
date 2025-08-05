import { callJiraApi } from '../jira.js';

export const mainRoutes = (app, db) => {
    app.post('/execute-template', async (req, res) => {
        const { template_id, user_emails, is_dry_run } = req.body;

        try {
            const template = await db.get('SELECT * FROM templates WHERE template_id = ?', template_id);
            const fieldMappings = JSON.parse(template.field_mappings);
            const users = await db.all(`SELECT * FROM users WHERE "E-mail" IN (${user_emails.map(() => '?').join(',')})`, user_emails);

            const results = [];
            for (const user of users) {
                const requestFieldValues = {};
                for (const [fieldId, mapping] of Object.entries(fieldMappings)) {
                    if (mapping.type === 'dynamic') {
                        requestFieldValues[fieldId] = user[mapping.value];
                    } else {
                        requestFieldValues[fieldId] = mapping.value;
                    }
                }

                const payload = {
                    serviceDeskId: template.service_desk_id,
                    requestTypeId: template.request_type_id,
                    requestFieldValues: requestFieldValues
                };

                if (is_dry_run) {
                    results.push({
                        status: 'dry-run',
                        user: user['E-mail'],
                        payload: payload
                    });
                } else {
                    // This is the real execution logic, which you can uncomment and adapt
                    // const jiraResponse = await callJiraApi('/rest/servicedeskapi/request', 'POST', payload);
                    // await db.run(
                    //     `INSERT INTO requests (issue_key, user_email, request_type_name, status, opened_at) VALUES (?, ?, ?, ?, ?)`,
                    //     [jiraResponse.issueKey, user['E-mail'], template.request_type_name, jiraResponse.currentStatus.status, new Date().toISOString()]
                    // );
                    // results.push({
                    //     status: 'success',
                    //     user: user['E-mail'],
                    //     issueKey: jiraResponse.issueKey
                    // });
                }
            }
            res.json(results);
        } catch (e) {
            res.status(500).json({ error: 'Failed to execute template', details: e.message });
        }
    });

    app.get('/jira/servicedesks', async (req, res) => res.json(await callJiraApi("/rest/servicedeskapi/servicedesk")));
    app.get('/jira/servicedesks/:id/requesttypes', async (req, res) => res.json(await callJiraApi(`/rest/servicedeskapi/servicedesk/${req.params.id}/requesttype`)));
    app.get('/jira/servicedesks/:sid/requesttypes/:rtid/fields', async (req, res) => res.json(await callJiraApi(`/rest/servicedeskapi/servicedesk/${req.params.sid}/requesttype/${req.params.rtid}/field`)));
};