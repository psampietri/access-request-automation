import { analyticsRoutes } from './analytics.js';
import { mainRoutes } from './main.js';
import { onboardingRoutes } from './onboarding.js';
import { requestsRoutes } from './requests.js';
import { templatesRoutes } from './templates.js';
import { usersRoutes } from './users.js';

export const setupRoutes = (app, db, JIRA_BASE_URL) => {
    analyticsRoutes(app, db);
    mainRoutes(app, db);
    onboardingRoutes(app, db);
    requestsRoutes(app, db, JIRA_BASE_URL);
    templatesRoutes(app, db);
    usersRoutes(app, db);
};