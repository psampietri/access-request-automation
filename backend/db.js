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
            service_desk_id TEXT,
            request_type_id TEXT,
            service_desk_name TEXT,
            request_type_name TEXT,
            field_mappings TEXT,
            is_manual INTEGER DEFAULT 0,
            instructions TEXT -- Added instructions field
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
            is_bypassed INTEGER DEFAULT 0,
            started_at TEXT, -- Added started_at field
            closed_at TEXT, -- Added closed_at field
            FOREIGN KEY(onboarding_instance_id) REFERENCES onboarding_instances(id),
            FOREIGN KEY(template_id) REFERENCES templates(template_id)
        );
        CREATE TABLE IF NOT EXISTS template_dependencies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER NOT NULL,
            depends_on_template_id INTEGER NOT NULL,
            FOREIGN KEY(template_id) REFERENCES templates(id),
            FOREIGN KEY(depends_on_template_id) REFERENCES templates(id)
        );
    `);

    // Add instructions column to templates table if it doesn't exist
    const templatesCols = await db.all("PRAGMA table_info(templates)");
    if (!templatesCols.some(col => col.name === 'instructions')) {
        await db.exec("ALTER TABLE templates ADD COLUMN instructions TEXT");
    }

    // Add started_at and closed_at columns to onboarding_instance_statuses table if they don't exist
    const statusesCols = await db.all("PRAGMA table_info(onboarding_instance_statuses)");
    if (!statusesCols.some(col => col.name === 'started_at')) {
        await db.exec("ALTER TABLE onboarding_instance_statuses ADD COLUMN started_at TEXT");
    }
    if (!statusesCols.some(col => col.name === 'closed_at')) {
        await db.exec("ALTER TABLE onboarding_instance_statuses ADD COLUMN closed_at TEXT");
    }


    return db;
};