export const templatesRoutes = (app, db) => {
    app.get('/templates', async (req, res) => {
        const templates = await db.all('SELECT * FROM templates ORDER BY template_name');
        res.json(templates);
    });

    app.post('/templates', async (req, res) => {
        const data = req.body;
        const { template_name, is_manual } = data;

        console.log(`\n--- Received request to create template: "${template_name}" (Manual: ${!!is_manual}) ---`);

        try {
            // 1. Check if a template with this name *actually* exists first.
            const existingTemplate = await db.get('SELECT * FROM templates WHERE template_name = ?', [template_name]);

            if (existingTemplate) {
                console.error(`🔴 CONFLICT: A template named "${template_name}" already exists in the database.`, existingTemplate);
                return res.status(409).json({ error: `A template named "${template_name}" truly already exists.` });
            }

            console.log(`🟢 CHECK PASSED: No template named "${template_name}" found. Proceeding with insert.`);

            // 2. Perform the insert based on the 'is_manual' flag.
            if (is_manual) {
                // Logic for creating a MANUAL template
                console.log(`Attempting to insert MANUAL template: "${template_name}"`);
                await db.run(
                    "INSERT INTO templates (template_name, is_manual) VALUES (?, 1)",
                    [template_name]
                );
            } else {
                // Logic for creating a JIRA template
                console.log(`Attempting to insert JIRA template: "${template_name}"`);
                await db.run(
                    "INSERT INTO templates (template_name, service_desk_id, request_type_id, service_desk_name, request_type_name, field_mappings, is_manual) VALUES (?, ?, ?, ?, ?, ?, 0)",
                    [template_name, data.service_desk_id, data.request_type_id, data.service_desk_name, data.request_type_name, JSON.stringify(data.field_mappings)]
                );
            }

            console.log(`✅ SUCCESS: Template "${template_name}" created successfully.`);
            res.status(201).json({ success: true });

        } catch (e) {
            console.error(`❌ UNEXPECTED ERROR during insert for "${template_name}":`, e);
            res.status(500).json({ error: "An unexpected server error occurred.", details: e.message });
        }
    });

    app.put('/templates/:template_id', async (req, res) => {
        const { template_id } = req.params;
        const data = req.body;
        try {
            await db.run(
                "UPDATE templates SET template_name = ?, service_desk_id = ?, request_type_id = ?, service_desk_name = ?, request_type_name = ?, field_mappings = ? WHERE template_id = ?",
                [data.template_name, data.service_desk_id, data.request_type_id, data.service_desk_name, data.request_type_name, JSON.stringify(data.field_mappings), template_id]
            );
            res.json({ success: true });
        } catch (e) {
            if (e.code === 'SQLITE_CONSTRAINT') {
                res.status(409).json({ error: "A template with this name already exists." });
            } else {
                res.status(500).json({ error: "Failed to update template", details: e.message });
            }
        }
    });

    app.delete('/templates/:template_id', async (req, res) => {
        const { template_id } = req.params;
        try {
            const usage = await db.get('SELECT * FROM onboarding_template_access_templates WHERE template_id = ?', [template_id]);
            if (usage) {
                return res.status(400).json({ error: 'Cannot delete a template that is in use by an onboarding template.' });
            }
            await db.run('DELETE FROM templates WHERE template_id = ?', [template_id]);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'Failed to delete template', details: e.message });
        }
    });
};