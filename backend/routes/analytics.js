export const analyticsRoutes = (app, db) => {
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
};