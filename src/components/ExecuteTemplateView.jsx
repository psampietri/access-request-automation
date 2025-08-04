import React from 'react';
import { PROXY_ENDPOINT } from '../constants';
import { EyeIcon } from './Icons';

export const ExecuteTemplateView = ({ log, users, templates }) => {
    const [selectedTemplateId, setSelectedTemplateId] = React.useState('');
    const [selectedUsers, setSelectedUsers] = React.useState(new Set());
    const [isProcessing, setIsProcessing] = React.useState(false);

    const handleExecute = async (isDryRun) => {
        if (!selectedTemplateId || selectedUsers.size === 0) {
            log('error', 'Please select a template and at least one user.');
            return;
        }
        setIsProcessing(true);
        const logPrefix = isDryRun ? '[DRY RUN]' : '';
        log('info', `--- Starting ${logPrefix} for ${selectedUsers.size} user(s) ---`);
        try {
            const res = await fetch(`${PROXY_ENDPOINT}/execute-template`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template_id: parseInt(selectedTemplateId),
                    user_emails: Array.from(selectedUsers),
                    is_dry_run: isDryRun
                })
            });
            const results = await res.json();
            if (!res.ok) throw new Error(results.error);

            results.forEach(result => {
                if (result.status === 'success') {
                    log('success', `SUCCESS for ${result.user}: Created ${result.issueKey}`);
                } else if (result.status === 'dry-run') {
                    log('info', `${logPrefix} Payload for ${result.user}:\n${JSON.stringify(result.payload, null, 2)}`);
                } else {
                    log('error', `ERROR for ${result.user}: ${JSON.stringify(result.details)}`);
                }
            });

        } catch (e) {
            log('error', `Execution failed: ${e.message}`);
        } finally {
            setIsProcessing(false);
            log('info', `--- ${logPrefix} Finished ---`);
        }
    };

    const handleSelectAll = () => {
        if (selectedUsers.size === users.length) {
            setSelectedUsers(new Set());
        } else {
            setSelectedUsers(new Set(users.map(u => u['E-mail'])));
        }
    };

    const handleSelectUser = (email) => {
        const newSelection = new Set(selectedUsers);
        if (newSelection.has(email)) {
            newSelection.delete(email);
        } else {
            newSelection.add(email);
        }
        setSelectedUsers(newSelection);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                    <h2 className="text-xl font-semibold">1. Select Template & Users</h2>
                    <select onChange={(e) => setSelectedTemplateId(e.target.value)} value={selectedTemplateId} className="w-full bg-slate-700 p-2 text-sm rounded my-4">
                        <option value="">-- Select a Template --</option>
                        {templates.map(t => <option key={t.template_id} value={t.template_id}>{t.template_name}</option>)}
                    </select>
                    <div className="max-h-60 overflow-y-auto border rounded-md border-slate-700">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-slate-700 sticky top-0">
                                <tr>
                                    <th scope="col" className="p-3 w-12">
                                        <input
                                            type="checkbox"
                                            onChange={handleSelectAll}
                                            checked={users.length > 0 && selectedUsers.size === users.length}
                                            className="w-4 h-4 rounded"
                                        />
                                    </th>
                                    <th scope="col" className="p-3">Name</th>
                                    <th scope="col" className="p-3">Email</th>
                                    <th scope="col" className="p-3">Team Name</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user['E-mail']} className="bg-slate-800 border-b border-slate-700">
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedUsers.has(user['E-mail'])}
                                                onChange={() => handleSelectUser(user['E-mail'])}
                                                className="w-4 h-4 rounded"
                                            />
                                        </td>
                                        <td className="p-3 font-medium">{user.Name} {user.Surname}</td>
                                        <td className="p-3">{user['E-mail']}</td>
                                        <td className="p-3">{user['Team Name']}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div className="space-y-6">
                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                    <h2 className="text-xl font-semibold mb-4">2. Execute</h2>
                    <div className="flex space-x-2">
                        <button onClick={() => handleExecute(true)} disabled={isProcessing || !selectedTemplateId} className="w-full flex items-center justify-center p-3 rounded-lg bg-sky-600 disabled:bg-slate-600">
                            <EyeIcon c="w-5 h-5 mr-2"/>Dry Run
                        </button>
                        <button onClick={() => handleExecute(false)} disabled={isProcessing || !selectedTemplateId} className="w-full flex items-center justify-center p-3 rounded-lg bg-green-600 disabled:bg-slate-600">
                            {isProcessing ? 'Processing...' : `Create ${selectedUsers.size} Ticket(s)`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
