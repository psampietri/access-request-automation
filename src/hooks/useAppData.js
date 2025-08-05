import React from 'react';
import { PROXY_ENDPOINT } from '../constants';
import { safeFetch } from '../utils/fetch'; // Import the new function

export const useAppData = (log) => {
    const [users, setUsers] = React.useState([]);
    const [userFields, setUserFields] = React.useState([]);
    const [templates, setTemplates] = React.useState([]);

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

    const syncWithJira = React.useCallback(async () => {
        log('info', 'Syncing with Jira...');
        // The original file had a `safeFetch` here that was not being used, so I've left it out.
        // If you need to fetch data here, you can use the new `safeFetch` function.
    }, [log]);

    React.useEffect(() => {
        fetchUsers();
        fetchTemplates();
        fetchUserFields();

        const intervalId = setInterval(syncWithJira, 3600000);
        return () => clearInterval(intervalId);
    }, [fetchUsers, fetchTemplates, fetchUserFields, syncWithJira]);

    return { users, userFields, templates, fetchUsers, fetchUserFields, fetchTemplates, syncWithJira };
};