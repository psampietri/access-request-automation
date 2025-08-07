export const templatesRoutes = (app, db) => {
    app.get('/templates', async (req, res) => {
        const templates = await db.all('SELECT * FROM templates ORDER BY template_name');
        const dependencies = await db.all('SELECT * FROM template_dependencies');

        for (const t of templates) {
            t.dependencies = dependencies
                .filter(d => d.template_id === t.template_id)
                .map(d => d.depends_on_template_id);
        }

        res.json(templates);
    });

    app.post('/templates', async (req, res) => {
        const data = req.body;

        if (data.is_manual) {
            try {
                await db.run(
                    "INSERT INTO templates (template_name, is_manual, instructions) VALUES (?, 1, ?)",
                    [data.template_name, data.instructions]
                );
                res.status(201).json({ success: true });
            } catch (e) {
                if (e.code === 'SQLITE_CONSTRAINT') {
                    res.status(409).json({ error: "A template with this name already exists." });
                } else {
                    res.status(500).json({ error: "Failed to save manual template", details: e.message });
                }
            }
        } else {
            try {
                await db.run(
                    "INSERT INTO templates (template_name, service_desk_id, request_type_id, service_desk_name, request_type_name, field_mappings, is_manual) VALUES (?, ?, ?, ?, ?, ?, 0)",
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
        }
    });

    app.put('/templates/:template_id', async (req, res) => {
        const { template_id } = req.params;
        const data = req.body;

        try {
            await db.run('BEGIN TRANSACTION');

            // Check if the template is manual to decide which fields to update
            const template = await db.get('SELECT is_manual FROM templates WHERE template_id = ?', [template_id]);

            if (template.is_manual) {
                await db.run(
                    "UPDATE templates SET template_name = ?, instructions = ? WHERE template_id = ?",
                    [data.template_name, data.instructions, template_id]
                );
            } else {
                await db.run(
                    "UPDATE templates SET template_name = ?, service_desk_id = ?, request_type_id = ?, service_desk_name = ?, request_type_name = ?, field_mappings = ? WHERE template_id = ?",
                    [data.template_name, data.service_desk_id, data.request_type_id, data.service_desk_name, data.request_type_name, JSON.stringify(data.field_mappings), template_id]
                );
            }

            // Update dependencies for all template types
            await db.run('DELETE FROM template_dependencies WHERE template_id = ?', [template_id]);
            if (data.dependencies && data.dependencies.length > 0) {
                for (const depId of data.dependencies) {
                    await db.run('INSERT INTO template_dependencies (template_id, depends_on_template_id) VALUES (?, ?)', [template_id, depId]);
                }
            }

            await db.run('COMMIT');
            res.json({ success: true });
        } catch (e) {
            if (db.inTransaction) await db.run('ROLLBACK');
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
            await db.run('BEGIN TRANSACTION');
            await db.run('DELETE FROM template_dependencies WHERE template_id = ? OR depends_on_template_id = ?', [template_id, template_id]);
            await db.run('DELETE FROM templates WHERE template_id = ?', [template_id]);
            await db.run('COMMIT');
            res.json({ success: true });
        } catch (e) {
            if (db.inTransaction) await db.run('ROLLBACK');
            res.status(500).json({ error: 'Failed to delete template', details: e.message });
        }
    });
};