import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

export const initDb = async (dbFile) => {
    const db = await open({
        filename: dbFile,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS templates (
            template_id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_name TEXT NOT NULL UNIQUE,
            service_desk_id TEXT,      -- REMOVED NOT NULL
            request_type_id TEXT,      -- REMOVED NOT NULL
            service_desk_name TEXT,
            request_type_name TEXT,
            field_mappings TEXT,       -- REMOVED NOT NULL
            is_manual INTEGER DEFAULT 0
        );

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

    return db;
};