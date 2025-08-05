import fetch from 'node-fetch';

let jiraApiToken;
let jiraBaseUrl;

export const initJira = (token, baseUrl) => {
    jiraApiToken = token;
    jiraBaseUrl = baseUrl;
};

export const callJiraApi = async (endpoint, method = 'GET', payload = null) => {
    const url = `${jiraBaseUrl}${endpoint}`;
    const headers = {
        'Authorization': `Bearer ${jiraApiToken}`,
        'Content-Type': 'application/json'
    };
    try {
        const options = { method, headers };
        if (payload) {
            options.body = JSON.stringify(payload);
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `Jira API request failed with status ${response.status}` }));
            throw { status: response.status, data: errorData };
        }
        return response.status === 204 ? { success: true } : await response.json();
    } catch (error) {
        console.error(`Jira API Error: ${error.status || 'Network Error'}`, error.data || error);
        throw error;
    }
};