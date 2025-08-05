import React from 'react';
import { PROXY_ENDPOINT } from '../constants';
import { TrashIcon, ChevronUpIcon, ChevronDownIcon } from './Icons';

export const HistoryView = ({ log, history, jiraBaseUrl, fetchHistory }) => {
    const [isLoading, setIsLoading] = React.useState(false);
    const [filters, setFilters] = React.useState({ status: '', user: '' });
    const [sortConfig, setSortConfig] = React.useState({ key: 'opened_at', direction: 'descending' });
    const [manualIssueKeys, setManualIssueKeys] = React.useState('');

    const handleManualSync = async () => {
        setIsLoading(true);
        await fetchHistory();
        setIsLoading(false);
    };

    const handleAddManualIssue = async (e) => {
        e.preventDefault();
        if (!manualIssueKeys) return;
        const keys = manualIssueKeys.split(/[\s,]+/).filter(Boolean);
        log('info', `Attempting to track ${keys.length} issue(s)...`);
        try {
            const response = await fetch(`${PROXY_ENDPOINT}/requests/manual`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ issue_keys: keys })
            });
            const data = await response.json();
            if (data.success.length > 0) log('success', `Successfully tracked: ${data.success.join(', ')}`);
            if (data.failed.length > 0) log('error', `Failed to track: ${data.failed.map(f => f.key).join(', ')}`);
            setManualIssueKeys('');
            fetchHistory();
        } catch (error) {
            log('error', `Error tracking issue: ${error.message}`);
        }
    };

    const handleDelete = async (issueKey) => {
        if (confirm(`Are you sure you want to stop tracking ${issueKey}?`)) {
            try {
                const res = await fetch(`${PROXY_ENDPOINT}/requests/${issueKey}`, { method: 'DELETE' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                log('info', `Stopped tracking ${issueKey}.`);
                fetchHistory(); // Refetch history after deletion
            } catch (e) {
                log('error', `Failed to delete: ${e.message}`);
            }
        }
    };

    const sortedAndFilteredRequests = React.useMemo(() =>
        history
            .filter(req =>
                (filters.status ? req.status === filters.status : true) &&
                (filters.user ? req.user_email.toLowerCase().includes(filters.user.toLowerCase()) : true)
            )
            .sort((a, b) => {
                if (!a[sortConfig.key]) return 1;
                if (!b[sortConfig.key]) return -1;
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            }),
        [history, filters, sortConfig]
    );

    const requestSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'ascending' ? 'descending' : 'ascending'
        }));
    };

    const SortableHeader = ({ children, name }) => (
        <th scope="col" className="p-3 cursor-pointer" onClick={() => requestSort(name)}>
            <div className="flex items-center">
                {children}
                {sortConfig.key === name && (sortConfig.direction === 'ascending' ? <ChevronUpIcon c="w-4 h-4 ml-1" /> : <ChevronDownIcon c="w-4 h-4 ml-1" />)}
            </div>
        </th>
    );

    return (
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 className="text-xl font-semibold">Request History</h2>
                <div className="flex items-center space-x-2 flex-wrap gap-2">
                    <form onSubmit={handleAddManualIssue} className="flex items-center space-x-2">
                        <textarea
                            placeholder="Track Issues (e.g., PROJ-123, PROJ-124)"
                            value={manualIssueKeys}
                            onChange={e => setManualIssueKeys(e.target.value.toUpperCase())}
                            className="bg-slate-700 border border-slate-600 rounded-md p-2 text-sm w-64 h-20 resize-none"
                        />
                        <button type="submit" className="px-3 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 self-start">Track Issues</button>
                    </form>
                    <button onClick={handleManualSync} disabled={isLoading} className="flex items-center px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-600 self-start">
                        {isLoading ? 'Syncing...' : 'Sync with Jira'}
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <input type="text" placeholder="Filter by User Email..." value={filters.user} onChange={e => setFilters({ ...filters, user: e.target.value })} className="bg-slate-700 border border-slate-600 rounded-md p-2 text-sm" />
                <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="bg-slate-700 border border-slate-600 rounded-md p-2 text-sm">
                    <option value="">All Statuses</option>
                    {[...new Set(history.map(r => r.status))].sort().map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div className="max-h-[32rem] overflow-y-auto border border-slate-700 rounded-md">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-300 uppercase bg-slate-700 sticky top-0">
                        <tr>
                            <SortableHeader name="issue_key">Issue Key</SortableHeader>
                            <SortableHeader name="user_email">User</SortableHeader>
                            <SortableHeader name="request_type_name">Request Type</SortableHeader>
                            <SortableHeader name="status">Status</SortableHeader>
                            <SortableHeader name="opened_at">Opened At</SortableHeader>
                            <SortableHeader name="closed_at">Closed At</SortableHeader>
                            <th scope="col" className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-slate-800">
                        {sortedAndFilteredRequests.map(req => (
                            <tr key={req.request_id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                <td className="p-3 font-medium text-blue-400 hover:underline">
                                    <a href={`${jiraBaseUrl}/browse/${req.issue_key}`} target="_blank" rel="noopener noreferrer">{req.issue_key}</a>
                                </td>
                                <td className="p-3">{req.user_email}</td>
                                <td className="p-3">{req.request_type_name}</td>
                                <td className="p-3">{req.status}</td>
                                <td className="p-3">{req.opened_at ? new Date(req.opened_at).toLocaleString() : 'N/A'}</td>
                                <td className="p-3">{req.closed_at ? new Date(req.closed_at).toLocaleString() : 'N/A'}</td>
                                <td className="p-3">
                                    <button onClick={() => handleDelete(req.issue_key)} className="text-slate-400 hover:text-red-400">
                                        <TrashIcon c="w-4 h-4"/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};