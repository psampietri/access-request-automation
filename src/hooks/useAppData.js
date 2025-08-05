import React from 'react';
import { PROXY_ENDPOINT } from '../constants';
import { safeFetch } from '../utils/fetch';

export const useAppData = (log) => {
    const [users, setUsers] = React.useState([]);
    const [userFields, setUserFields] = React.useState([]);
    const [templates, setTemplates] = React.useState([]);
    const [history, setHistory] = React.useState([]);
    const [jiraBaseUrl, setJiraBaseUrl] = React.useState('');
    const [onboardingTemplates, setOnboardingTemplates] = React.useState([]);
    const [onboardingInstances, setOnboardingInstances] = React.useState([]);

    const fetchUsers = React.useCallback(async () => {
        const data = await safeFetch(`${PROXY_ENDPOINT}/users`, log, 'Could not load users');
        if (data) setUsers(data);
    }, [log]);

    const fetchUserFields = React.useCallback(async () => {
        const data = await safeFetch(`${PROXY_ENDPOINT}/user-fields`, log, 'Could not load user fields');
        if (data) setUserFields(data);
    }, [log]);

    const fetchTemplates = React.useCallback(async () => {
        const data = await safeFetch(`${PROXY_ENDPOINT}/templates`, log, 'Could not load templates');
        if (data) setTemplates(data);
    }, [log]);

    const fetchHistory = React.useCallback(async () => {
        log('info', 'Syncing request history...');
        const data = await safeFetch(`${PROXY_ENDPOINT}/requests`, log, 'Could not fetch history');
        if (data) {
            setHistory(data.requests);
            setJiraBaseUrl(data.jira_base_url);
            log('success', 'History synced.');
        }
    }, [log]);

    const fetchOnboardingTemplates = React.useCallback(async () => {
        const data = await safeFetch(`${PROXY_ENDPOINT}/onboarding/templates`, log, 'Could not load onboarding templates');
        if (data) setOnboardingTemplates(data);
    }, [log]);

    const fetchOnboardingInstances = React.useCallback(async () => {
        const data = await safeFetch(`${PROXY_ENDPOINT}/onboarding/instances`, log, 'Could not load onboarding instances');
        if (data) setOnboardingInstances(data);
    }, [log]);

    React.useEffect(() => {
        fetchUsers();
        fetchTemplates();
        fetchUserFields();
        fetchHistory();
        fetchOnboardingTemplates();
        fetchOnboardingInstances();

        const intervalId = setInterval(fetchHistory, 3600000); // Sync every hour
        return () => clearInterval(intervalId);
    }, [fetchUsers, fetchTemplates, fetchUserFields, fetchHistory, fetchOnboardingTemplates, fetchOnboardingInstances]);

    return { users, userFields, templates, history, jiraBaseUrl, onboardingTemplates, onboardingInstances, fetchUsers, fetchUserFields, fetchTemplates, fetchHistory, fetchOnboardingTemplates, fetchOnboardingInstances };
};