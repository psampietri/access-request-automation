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
        // --- START OF FIX ---
        // Added a 30-second timeout to the request
        const options = {
            method,
            headers,
            timeout: 30000 // 30 seconds
        };
        // --- END OF FIX ---

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

export const getJiraIssueDetails = async (issueKey) => {
    try {
        // First, try the Service Desk API
        const serviceDeskIssue = await callJiraApi(`/rest/servicedeskapi/request/${issueKey}`);
        return serviceDeskIssue;
    } catch (error) {
        if (error.status === 404) {
            // If not found, try the generic Jira API
            try {
                const genericIssue = await callJiraApi(`/rest/api/2/issue/${issueKey}`);
                // Normalize the response to match the Service Desk API structure
                return {
                    issueKey: genericIssue.key,
                    requestType: { name: genericIssue.fields.issuetype.name },
                    createdDate: { iso8601: genericIssue.fields.created },
                    currentStatus: {
                        status: genericIssue.fields.status.name,
                        statusCategory: genericIssue.fields.status.statusCategory.key,
                        statusDate: { iso8601: genericIssue.fields.resolutiondate || genericIssue.fields.updated }
                    }
                };
            } catch (genericError) {
                // If the generic API also fails, throw that error
                throw genericError;
            }
        }
        // If the error was not a 404, re-throw it
        throw error;
    }
};