import { callJiraApi } from '../jira.js';
import { formatJiraPayload } from '../utils.js';

export const mainRoutes = (app, db) => {

    app.post('/templates/migrate-schemas', async (req, res) => {
        console.log('Starting schema migration for all templates...');
        try {
            const templates = await db.all('SELECT * FROM templates');
            let updatedCount = 0;

            for (const template of templates) {
                try {
                    const fieldsData = await callJiraApi(`/rest/servicedeskapi/servicedesk/${template.service_desk_id}/requesttype/${template.request_type_id}/field`);

                    if (fieldsData && fieldsData.requestTypeFields) {
                        const fieldMappings = JSON.parse(template.field_mappings);
                        let needsUpdate = false;

                        for (const [fieldId, mapping] of Object.entries(fieldMappings)) {
                            // Check if the jiraSchema is missing or incomplete
                            if (!mapping.jiraSchema || typeof mapping.jiraSchema.type === 'undefined') {
                                const field = fieldsData.requestTypeFields.find(f => f.fieldId === fieldId);
                                if (field) {
                                    mapping.jiraSchema = field.jiraSchema;
                                    needsUpdate = true;
                                }
                            }
                        }

                        if (needsUpdate) {
                            await db.run(
                                "UPDATE templates SET field_mappings = ? WHERE template_id = ?",
                                [JSON.stringify(fieldMappings), template.template_id]
                            );
                            updatedCount++;
                        }
                    }
                } catch (e) {
                    console.error(`Could not migrate schema for template ${template.template_name}: ${e.message}`);
                }
            }
            const successMessage = `Schema migration completed. Updated ${updatedCount} templates.`;
            console.log(successMessage);
            res.json({ success: true, message: successMessage });

        } catch (e) {
            const errorMessage = `Failed to migrate schemas: ${e.message}`;
            console.error(errorMessage);
            res.status(500).json({ error: errorMessage });
        }
    });

    app.post('/execute-template', async (req, res) => {
        const { template_id, user_emails, is_dry_run } = req.body;

        try {
            const template = await db.get('SELECT * FROM templates WHERE template_id = ?', template_id);
            const fieldMappings = JSON.parse(template.field_mappings);
            const users = await db.all(`SELECT * FROM users WHERE "E-mail" IN (${user_emails.map(() => '?').join(',')})`, user_emails);

            const results = [];
            for (const user of users) {
                const requestFieldValues = formatJiraPayload(fieldMappings, user);

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