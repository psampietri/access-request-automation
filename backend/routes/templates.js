export const templatesRoutes = (app, db) => {
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