export const usersRoutes = (app, db) => {
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
};