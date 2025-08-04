import React from 'react';
import { PROXY_ENDPOINT } from '../constants';

const useSafeFetch = (log) => {
    return React.useCallback(async (url, errMsg) => {
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Server responded with ${response.status}`);
            return data;
        } catch (error) {
            log('error', `${errMsg}: ${error.message}`);
            return null;
        }
    }, [log]);
};

export const useAppData = (log) => {
    const [users, setUsers] = React.useState([]);
    const [userFields, setUserFields] = React.useState([]);
    const [templates, setTemplates] = React.useState([]);
    const safeFetch = useSafeFetch(log);

    const fetchUsers = React.useCallback(async () => {
        const data = await safeFetch(`${PROXY_ENDPOINT}/users`, 'Could not load users');
        if (data) setUsers(data);
    }, [safeFetch]);

    const fetchUserFields = React.useCallback(async () => {
        const data = await safeFetch(`${PROXY_ENDPOINT}/user-fields`, 'Could not load user fields');
        if (data) setUserFields(data);
    }, [safeFetch]);

    const fetchTemplates = React.useCallback(async () => {
        const data = await safeFetch(`${PROXY_ENDPOINT}/templates`, 'Could not load templates');
        if (data) setTemplates(data);
    }, [safeFetch]);

    const syncWithJira = React.useCallback(async () => {
        log('info', 'Syncing with Jira...');
    }, [safeFetch, log]);

    React.useEffect(() => {
        fetchUsers();
        fetchTemplates();
        fetchUserFields();

        const intervalId = setInterval(syncWithJira, 3600000);
        return () => clearInterval(intervalId);
    }, [fetchUsers, fetchTemplates, fetchUserFields, syncWithJira]);

    return { users, userFields, templates, fetchUsers, fetchUserFields, fetchTemplates, syncWithJira };
};