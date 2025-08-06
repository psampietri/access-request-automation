import { callJiraApi, getJiraIssueDetails } from '../jira.js';
import { formatJiraPayload } from '../utils.js';

export const onboardingRoutes = (app, db) => {
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
        const { name, template_ids: newTemplateIds } = req.body;

        try {
            await db.run('BEGIN TRANSACTION');

            const originalTemplateLinks = await db.all('SELECT template_id FROM onboarding_template_access_templates WHERE onboarding_template_id = ?', [id]);
            const originalTemplateIds = originalTemplateLinks.map(t => t.template_id);
            const templatesToRemove = originalTemplateIds.filter(tid => !newTemplateIds.includes(tid));

            const instances = await db.all('SELECT id FROM onboarding_instances WHERE onboarding_template_id = ?', [id]);
            if (instances.length > 0 && templatesToRemove.length > 0) {
                const instanceIds = instances.map(i => i.id);
                const placeholders = '?,'.repeat(instanceIds.length).slice(0, -1);

                const actionedStatuses = await db.all(
                    `SELECT template_id FROM onboarding_instance_statuses WHERE onboarding_instance_id IN (${placeholders}) AND issue_key IS NOT NULL AND template_id IN (${'?,'.repeat(templatesToRemove.length).slice(0, -1)})`,
                    [...instanceIds, ...templatesToRemove]
                );

                if (actionedStatuses.length > 0) {
                    const problemTemplateIds = [...new Set(actionedStatuses.map(s => s.template_id))];
                    const problemTemplatePlaceholders = '?,'.repeat(problemTemplateIds.length).slice(0, -1);
                    const problemTemplateNames = await db.all(
                        `SELECT template_name FROM templates WHERE template_id IN (${problemTemplatePlaceholders})`,
                        problemTemplateIds
                    );
                    await db.run('ROLLBACK');
                    return res.status(400).json({
                        error: `Cannot remove templates that have already been actioned: ${problemTemplateNames.map(t => t.template_name).join(', ')}`
                    });
                }
            }

            await db.run('UPDATE onboarding_templates SET name = ? WHERE id = ?', [name, id]);

            await db.run('DELETE FROM onboarding_template_access_templates WHERE onboarding_template_id = ?', [id]);
            for (const templateId of newTemplateIds) {
                await db.run('INSERT INTO onboarding_template_access_templates (onboarding_template_id, template_id) VALUES (?, ?)', [id, templateId]);
            }

            for (const instance of instances) {
                if (templatesToRemove.length > 0) {
                    const removePlaceholders = '?,'.repeat(templatesToRemove.length).slice(0, -1);
                    await db.run(
                        `DELETE FROM onboarding_instance_statuses WHERE onboarding_instance_id = ? AND template_id IN (${removePlaceholders})`,
                        [instance.id, ...templatesToRemove]
                    );
                }

                const currentInstanceStatuses = await db.all('SELECT template_id FROM onboarding_instance_statuses WHERE onboarding_instance_id = ?', [instance.id]);
                const currentInstanceTemplateIds = currentInstanceStatuses.map(s => s.template_id);
                const templatesToAdd = newTemplateIds.filter(tid => !currentInstanceTemplateIds.includes(tid));
                for (const templateIdToAdd of templatesToAdd) {
                    await db.run(
                        'INSERT INTO onboarding_instance_statuses (onboarding_instance_id, template_id) VALUES (?, ?)',
                        [instance.id, templateIdToAdd]
                    );
                }
            }

            await db.run('COMMIT');
            res.json({ success: true });
        } catch (e) {
            if (db.inTransaction) await db.run('ROLLBACK');
            res.status(500).json({ error: 'Failed to update onboarding template', details: e.message });
        }
    });

    app.delete('/onboarding/templates/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const instances = await db.all('SELECT id FROM onboarding_instances WHERE onboarding_template_id = ?', [id]);
            if (instances.length > 0) {
                return res.status(400).json({ error: 'Cannot delete a template that is currently assigned to one or more onboarding instances.' });
            }

            await db.run('BEGIN TRANSACTION');
            await db.run('DELETE FROM onboarding_template_access_templates WHERE onboarding_template_id = ?', [id]);
            await db.run('DELETE FROM onboarding_templates WHERE id = ?', [id]);
            await db.run('COMMIT');

            res.json({ success: true });
        } catch (e) {
            if (db.inTransaction) await db.run('ROLLBACK');
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
            await db.run('DELETE FROM onboarding_instance_statuses WHERE onboarding_instance_id = ?', [id]);
            await db.run('DELETE FROM onboarding_instances WHERE id = ?', [id]);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'Failed to delete onboarding instance', details: e.message });
        }
    });

    app.post('/onboarding/instances/:instance_id/associate/:template_id', async (req, res) => {
        const { instance_id, template_id } = req.params;
        const { issue_key } = req.body;

        try {
            // 1. Validate the issue with Jira
            const jiraResponse = await getJiraIssueDetails(issue_key);

            const currentStatus = jiraResponse?.currentStatus?.status || 'N/A';
            const issueKey = jiraResponse?.issueKey;

            if (!issueKey) {
                throw new Error("Invalid Jira response: issueKey is missing.");
            }

            // 2. Update the onboarding_instance_statuses table
            await db.run(
                'UPDATE onboarding_instance_statuses SET status = ?, issue_key = ? WHERE onboarding_instance_id = ? AND template_id = ?',
                [currentStatus, issueKey, instance_id, template_id]
            );

            // 3. (Optional) Add to the main requests table if it doesn't exist
            const existingRequest = await db.get('SELECT * FROM requests WHERE issue_key = ?', [issueKey]);
            if (!existingRequest) {
                const instance = await db.get('SELECT user_email FROM onboarding_instances WHERE id = ?', [instance_id]);
                const template = await db.get('SELECT request_type_name FROM templates WHERE template_id = ?', [template_id]);
                const requestTypeName = template?.request_type_name || 'N/A';
                const createdDate = jiraResponse?.createdDate?.iso8601 || new Date().toISOString();

                await db.run(
                    `INSERT INTO requests (issue_key, user_email, request_type_name, status, opened_at) VALUES (?, ?, ?, ?, ?)`,
                    [issueKey, instance.user_email, requestTypeName, currentStatus, createdDate]
                );
            }

            res.json({ success: true, issueKey: issueKey });
        } catch (error) {
            res.status(500).json({ error: 'Failed to associate request', details: error.message });
        }
    });


    app.post('/onboarding/instances/:instance_id/execute/:template_id', async (req, res) => {
        const { instance_id, template_id } = req.params;
        try {
            const instance = await db.get('SELECT user_email FROM onboarding_instances WHERE id = ?', [instance_id]);
            const user = await db.get('SELECT * FROM users WHERE "E-mail" = ?', [instance.user_email]);
            const template = await db.get('SELECT * FROM templates WHERE template_id = ?', [template_id]);
            const fieldMappings = JSON.parse(template.field_mappings);

            const requestFieldValues = formatJiraPayload(fieldMappings, user);

            const requestData = {
                serviceDeskId: template.service_desk_id,
                requestTypeId: template.request_type_id,
                requestFieldValues: requestFieldValues
            };

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

    app.post('/onboarding/instances/:instance_id/manual-complete/:template_id', async (req, res) => {
        const { instance_id, template_id } = req.params;
        try {
            await db.run(
                'UPDATE onboarding_instance_statuses SET status = ? WHERE onboarding_instance_id = ? AND template_id = ?',
                ['Completed', instance_id, template_id]
            );
            res.json({ success: true, message: 'Task marked as completed.' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to update task status', details: error.message });
        }
    });

    app.post('/onboarding/instances/:instance_id/manual-associate/:template_id', async (req, res) => {
        const { instance_id, template_id } = req.params;
        const { issue_key, status } = req.body;

        if (!issue_key || !status) {
            return res.status(400).json({ error: 'Issue key and status are required.' });
        }

        try {
            // 1. Update the specific task in the onboarding instance
            await db.run(
                'UPDATE onboarding_instance_statuses SET status = ?, issue_key = ? WHERE onboarding_instance_id = ? AND template_id = ?',
                [status, issue_key, instance_id, template_id]
            );

            // 2. Add to the main requests table for tracking consistency
            const existingRequest = await db.get('SELECT * FROM requests WHERE issue_key = ?', [issue_key]);
            if (!existingRequest) {
                const instance = await db.get('SELECT user_email FROM onboarding_instances WHERE id = ?', [instance_id]);
                const template = await db.get('SELECT template_name FROM templates WHERE template_id = ?', [template_id]);
                await db.run(
                    `INSERT INTO requests (issue_key, user_email, request_type_name, status, opened_at) VALUES (?, ?, ?, ?, ?)`,
                    [issue_key, instance.user_email, template.template_name, status, new Date().toISOString()]
                );
            }

            res.json({ success: true, issueKey: issue_key });
        } catch (error) {
            res.status(500).json({ error: 'Failed to manually associate request', details: error.message });
        }
    });

    app.put('/onboarding/instances/:instance_id/status/:template_id', async (req, res) => {
        const { instance_id, template_id } = req.params;
        const { status, issue_key } = req.body; // We'll use the existing issue_key

        if (!status || !issue_key) {
            return res.status(400).json({ error: 'Status and issue key are required.' });
        }

        try {
            await db.run('BEGIN TRANSACTION');

            // Update the onboarding status
            await db.run(
                'UPDATE onboarding_instance_statuses SET status = ? WHERE onboarding_instance_id = ? AND template_id = ?',
                [status, instance_id, template_id]
            );

            // Also update the main requests table to keep it in sync
            await db.run(
                'UPDATE requests SET status = ? WHERE issue_key = ?',
                [status, issue_key]
            );

            await db.run('COMMIT');
            res.json({ success: true, message: `Status updated to "${status}"` });

        } catch (error) {
            if (db.inTransaction) await db.run('ROLLBACK');
            res.status(500).json({ error: 'Failed to update status', details: error.message });
        }
    });

    app.put('/onboarding/instances/:instance_id/status/:template_id', async (req, res) => {
        const { instance_id, template_id } = req.params;
        const { status, issue_key } = req.body;

        if (!status || !issue_key) {
            return res.status(400).json({ error: 'Status and issue key are required.' });
        }

        try {
            await db.run('BEGIN TRANSACTION');

            // Update the onboarding status
            await db.run(
                'UPDATE onboarding_instance_statuses SET status = ? WHERE onboarding_instance_id = ? AND template_id = ?',
                [status, instance_id, template_id]
            );

            // Also update the main requests table to keep it in sync
            await db.run(
                'UPDATE requests SET status = ? WHERE issue_key = ?',
                [status, issue_key]
            );

            await db.run('COMMIT');
            res.json({ success: true, message: `Status updated to "${status}"` });

        } catch (error) {
            if (db.inTransaction) await db.run('ROLLBACK');
            res.status(500).json({ error: 'Failed to update status', details: error.message });
        }
    });

    app.post('/onboarding/instances/:instance_id/unassign/:template_id', async (req, res) => {
        const { instance_id, template_id } = req.params;
        const { issue_key } = req.body; // Pass the issue_key to be extra safe

        if (!issue_key) {
            return res.status(400).json({ error: 'Issue key is required.' });
        }

        try {
            await db.run('BEGIN TRANSACTION');

            // Reset the status and remove the issue key from the onboarding task
            await db.run(
                `UPDATE onboarding_instance_statuses 
             SET status = 'Not Started', issue_key = NULL 
             WHERE onboarding_instance_id = ? AND template_id = ?`,
                [instance_id, template_id]
            );

            // We will also remove the corresponding entry from the main 'requests' table
            // to prevent orphaned records that are no longer tracked in any onboarding.
            await db.run(
                'DELETE FROM requests WHERE issue_key = ?',
                [issue_key]
            );

            await db.run('COMMIT');
            res.json({ success: true, message: `Ticket ${issue_key} has been unassigned.` });

        } catch (error) {
            if (db.inTransaction) await db.run('ROLLBACK');
            res.status(500).json({ error: 'Failed to unassign ticket', details: error.message });
        }
    });

};