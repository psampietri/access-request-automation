import React from 'react';
import { PROXY_ENDPOINT } from '../constants';
import { 
    TrashIcon, EditIcon, XIcon, SendIcon, EyeIcon, LinkIcon, 
    CheckCircleIcon, RefreshCwIcon, LinkOffIcon, LockIcon, UnlockIcon 
} from './Icons';
import { SparklineProgress } from './SparklineProgress';

export const OnboardingView = ({ log, users, templates, onboardingTemplates, onboardingInstances, fetchOnboardingTemplates, fetchOnboardingInstances }) => {
    const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
    const [isInstanceModalOpen, setIsInstanceModalOpen] = React.useState(false);
    const [isInstanceDetailModalOpen, setIsInstanceDetailModalOpen] = React.useState(false);
    const [isAssociateModalOpen, setIsAssociateModalOpen] = React.useState(false);
    const [isManualAssociateModalOpen, setIsManualAssociateModalOpen] = React.useState(false);
    const [isUpdateStatusModalOpen, setIsUpdateStatusModalOpen] = React.useState(false);
    
    const [editingTemplate, setEditingTemplate] = React.useState(null);
    const [templateName, setTemplateName] = React.useState('');
    const [selectedTemplateIds, setSelectedTemplateIds] = React.useState(new Set());
    
    const [selectedUser, setSelectedUser] = React.useState('');
    const [selectedOnboardingTemplate, setSelectedOnboardingTemplate] = React.useState('');
    const [selectedInstance, setSelectedInstance] = React.useState(null);
    
    const [associationInfo, setAssociationInfo] = React.useState({ instanceId: null, templateId: null, issueKey: null });
    const [issueKey, setIssueKey] = React.useState('');
    const [manualIssueKey, setManualIssueKey] = React.useState('');
    const [manualStatus, setManualStatus] = React.useState('');
    const [newStatus, setNewStatus] = React.useState('');

    const userMap = React.useMemo(() => {
        return users.reduce((acc, user) => {
            acc[user['E-mail']] = `${user.Name} ${user.Surname}`;
            return acc;
        }, {});
    }, [users]);
    
    React.useEffect(() => {
        if (isInstanceDetailModalOpen && selectedInstance) {
            const updatedInstance = onboardingInstances.find(inst => inst.id === selectedInstance.id);
            if (updatedInstance) {
                setSelectedInstance(updatedInstance);
            }
        }
    }, [onboardingInstances, isInstanceDetailModalOpen, selectedInstance]);

    const handleSaveTemplate = async (e) => {
        e.preventDefault();
        if (!templateName || selectedTemplateIds.size === 0) {
            log('error', 'Please provide a name and select at least one access template.');
            return;
        }
        const payload = {
            name: templateName,
            template_ids: Array.from(selectedTemplateIds),
        };
        const url = editingTemplate
            ? `${PROXY_ENDPOINT}/onboarding/templates/${editingTemplate.id}`
            : `${PROXY_ENDPOINT}/onboarding/templates`;
        const method = editingTemplate ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            log('success', `Onboarding template '${templateName}' saved.`);
            fetchOnboardingTemplates();
            fetchOnboardingInstances();
            setIsTemplateModalOpen(false);
        } catch (error) {
            log('error', `Failed to save onboarding template: ${error.message}`);
        }
    };
    
    const handleDeleteTemplate = async (templateId) => {
        if (confirm('Are you sure you want to delete this onboarding template?')) {
            try {
                const res = await fetch(`${PROXY_ENDPOINT}/onboarding/templates/${templateId}`, { method: 'DELETE' });
                if (!res.ok) throw new Error((await res.json()).error);
                log('info', 'Onboarding template deleted.');
                fetchOnboardingTemplates();
            } catch (e) {
                log('error', `Failed to delete onboarding template: ${e.message}`);
            }
        }
    };

    const handleInitiateOnboarding = async (e) => {
        e.preventDefault();
        if (!selectedUser || !selectedOnboardingTemplate) {
            log('error', 'Please select a user and an onboarding template.');
            return;
        }
        try {
            const res = await fetch(`${PROXY_ENDPOINT}/onboarding/instances`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_email: selectedUser,
                    onboarding_template_id: selectedOnboardingTemplate
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            log('success', `Onboarding initiated for ${selectedUser}.`);
            fetchOnboardingInstances();
            setIsInstanceModalOpen(false);
        } catch (error) {
            log('error', `Failed to initiate onboarding: ${error.message}`);
        }
    };

    const handleExecuteRequest = async (instanceId, templateId) => {
        log('info', `Executing request for template ${templateId}...`);
        try {
            const res = await fetch(`${PROXY_ENDPOINT}/onboarding/instances/${instanceId}/execute/${templateId}`, {
                method: 'POST'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            log('success', `Request created: ${data.issueKey}`);
            fetchOnboardingInstances();
        } catch (error) {
            log('error', `Failed to execute request: ${error.message}`);
        }
    };

    const handleAssociateRequest = async (e) => {
        e.preventDefault();
        const { instanceId, templateId } = associationInfo;
        log('info', `Associating ticket ${issueKey}...`);
        try {
            const res = await fetch(`${PROXY_ENDPOINT}/onboarding/instances/${instanceId}/associate/${templateId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ issue_key: issueKey })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            log('success', `Ticket ${data.issueKey} associated.`);
            fetchOnboardingInstances();
            setIsAssociateModalOpen(false);
            setIssueKey('');
        } catch (error) {
            log('error', `Failed to associate ticket: ${error.message}`);
        }
    };

    const handleDeleteInstance = async (instanceId) => {
        if (confirm('Are you sure you want to delete this onboarding instance?')) {
            try {
                const res = await fetch(`${PROXY_ENDPOINT}/onboarding/instances/${instanceId}`, { method: 'DELETE' });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error);
                }
                log('info', 'Onboarding instance deleted.');
                fetchOnboardingInstances();
            } catch (e) {
                log('error', `Failed to delete onboarding instance: ${e.message}`);
            }
        }
    };

    const handleMarkAsComplete = async (instanceId, templateId) => {
        log('info', `Marking manual task for template ${templateId} as complete...`);
        try {
            const res = await fetch(`${PROXY_ENDPOINT}/onboarding/instances/${instanceId}/manual-complete/${templateId}`, {
                method: 'POST'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            log('success', data.message);
            fetchOnboardingInstances();
        } catch (error) {
            log('error', `Failed to mark task as complete: ${error.message}`);
        }
    };

    const handleManualAssociateRequest = async (e) => {
        e.preventDefault();
        const { instanceId, templateId } = associationInfo;
        log('info', `Manually associating ticket ${manualIssueKey} with status "${manualStatus}"...`);
        try {
            const res = await fetch(`${PROXY_ENDPOINT}/onboarding/instances/${instanceId}/manual-associate/${templateId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ issue_key: manualIssueKey, status: manualStatus })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            log('success', `Ticket ${data.issueKey} associated.`);
            fetchOnboardingInstances();
            setIsManualAssociateModalOpen(false);
            setManualIssueKey('');
            setManualStatus('');
        } catch (error) {
            log('error', `Failed to manually associate ticket: ${error.message}`);
        }
    };

    const handleUpdateStatus = async (e) => {
        e.preventDefault();
        const { instanceId, templateId, issueKey } = associationInfo;
        log('info', `Updating status for ${issueKey} to "${newStatus}"...`);
        try {
            const res = await fetch(`${PROXY_ENDPOINT}/onboarding/instances/${instanceId}/status/${templateId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, issue_key: issueKey })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            log('success', data.message);
            fetchOnboardingInstances();
            setIsUpdateStatusModalOpen(false);
        } catch (error) {
            log('error', `Failed to update status: ${error.message}`);
        }
    };

    const handleUnassignTicket = async (instanceId, templateId, issueKey) => {
        if (!confirm(`Are you sure you want to unassign ticket ${issueKey}? This will reset the task's progress.`)) {
            return;
        }
        log('info', `Unassigning ticket ${issueKey}...`);
        try {
            const res = await fetch(`${PROXY_ENDPOINT}/onboarding/instances/${instanceId}/unassign/${templateId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ issue_key: issueKey })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            log('success', data.message);
            fetchOnboardingInstances();
        } catch (error) {
            log('error', `Failed to unassign ticket: ${error.message}`);
        }
    };

    const handleBypass = async (instanceId, templateId) => {
        if (!confirm('Are you sure you want to bypass this dependency? This will unlock the task.')) {
            return;
        }
        log('info', `Bypassing dependency for task...`);
        try {
            const res = await fetch(`${PROXY_ENDPOINT}/onboarding/instances/${instanceId}/bypass/${templateId}`, {
                method: 'POST',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            log('success', data.message);
            fetchOnboardingInstances();
        } catch (error) {
            log('error', `Failed to bypass dependency: ${error.message}`);
        }
    };

    const openTemplateModal = (template = null) => {
        setEditingTemplate(template);
        setTemplateName(template ? template.name : '');
        setSelectedTemplateIds(template ? new Set(template.template_ids) : new Set());
        // --- THIS LINE IS NOW REMOVED ---
        setIsTemplateModalOpen(true);
    };

    const openInstanceDetailModal = (instance) => {
        setSelectedInstance(instance);
        setIsInstanceDetailModalOpen(true);
    };

    const openAssociateModal = (instanceId, templateId, isManual = false) => {
        setAssociationInfo({ instanceId, templateId });
        if (isManual) {
            setIsManualAssociateModalOpen(true);
        } else {
            setIsAssociateModalOpen(true);
        }
    };

    const openUpdateStatusModal = (instanceId, templateId, currentStatus) => {
        const instance = onboardingInstances.find(inst => inst.id === instanceId);
        const statusInfo = instance?.statuses.find(s => s.template_id === templateId);
        setAssociationInfo({ instanceId, templateId, issueKey: statusInfo?.issue_key });
        setNewStatus(currentStatus);
        setIsUpdateStatusModalOpen(true);
    };

    return (
        <>
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Onboarding Instances</h2>
                    <button onClick={() => setIsInstanceModalOpen(true)} className="px-3 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700">
                        Initiate Onboarding
                    </button>
                </div>
                <div className="max-h-60 overflow-y-auto border border-slate-700 rounded-md">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-300 uppercase bg-slate-700 sticky top-0">
                            <tr>
                                <th scope="col" className="p-3">User</th>
                                <th scope="col" className="p-3">Onboarding Template</th>
                                <th scope="col" className="p-3">Status</th>
                                <th scope="col" className="p-3">Progress</th>
                                <th scope="col" className="p-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {onboardingInstances.map(inst => {
                                const closedTasks = inst.statuses.filter(s => ['closed', 'done', 'completed'].includes(s.status.toLowerCase())).length;
                                const inProgressTasks = inst.statuses.filter(s => s.status.toLowerCase() !== 'not started' && !['closed', 'done', 'completed'].includes(s.status.toLowerCase())).length;
                                const totalTasks = inst.statuses.length;
                                const completedTasks = closedTasks + inProgressTasks;

                                return (
                                    <tr key={inst.id} className="bg-slate-800 border-b border-slate-700">
                                        <td className="p-3" title={inst.user_email}>
                                            {userMap[inst.user_email] || inst.user_email}
                                        </td>
                                        <td className="p-3">{inst.onboarding_template_name}</td>
                                        <td className="p-3">
                                            {completedTasks} / {totalTasks} tasks started
                                        </td>
                                        <td className="p-3">
                                            <SparklineProgress 
                                                closed={closedTasks} 
                                                inProgress={inProgressTasks} 
                                                total={totalTasks} 
                                            />
                                        </td>
                                        <td className="p-3 flex space-x-2">
                                            <button onClick={() => openInstanceDetailModal(inst)} className="text-blue-400 hover:text-blue-300">
                                                <EyeIcon c="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDeleteInstance(inst.id)} className="text-red-400 hover:text-red-300">
                                                <TrashIcon c="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 mt-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Onboarding Templates</h2>
                    <button onClick={() => openTemplateModal()} className="px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        Create Template
                    </button>
                </div>
                <div className="max-h-60 overflow-y-auto border border-slate-700 rounded-md">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-300 uppercase bg-slate-700 sticky top-0">
                            <tr>
                                <th scope="col" className="p-3">Template Name</th>
                                <th scope="col" className="p-3">Access Templates</th>
                                <th scope="col" className="p-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {onboardingTemplates.map(ot => (
                                <tr key={ot.id} className="bg-slate-800 border-b border-slate-700">
                                    <td className="p-3">{ot.name}</td>
                                    <td className="p-3 text-xs text-slate-400">{ot.template_names.join(', ')}</td>
                                    <td className="p-3 flex space-x-2">
                                        <button onClick={() => openTemplateModal(ot)}><EditIcon c="w-4 h-4"/></button>
                                        <button onClick={() => handleDeleteTemplate(ot.id)}><TrashIcon c="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isTemplateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-lg">
                        <header className="flex justify-between items-center p-4 border-b border-slate-700">
                            <h2 className="text-xl font-bold">{editingTemplate ? 'Edit' : 'Create'} Onboarding Template</h2>
                            <button onClick={() => setIsTemplateModalOpen(false)}><XIcon c="w-6 h-6" /></button>
                        </header>
                        <form onSubmit={handleSaveTemplate} className="p-4 space-y-4">
                            <input
                                type="text"
                                placeholder="Template Name"
                                value={templateName}
                                onChange={e => setTemplateName(e.target.value)}
                                className="w-full bg-slate-700 p-2 text-sm rounded"
                                required
                            />
                            <div className="max-h-60 overflow-y-auto border border-slate-700 rounded-md p-2 space-y-2">
                                {templates.map(t => (
                                    <div key={t.template_id}>
                                        <label className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedTemplateIds.has(t.template_id)}
                                                onChange={() => {
                                                    const newSet = new Set(selectedTemplateIds);
                                                    if (newSet.has(t.template_id)) {
                                                        newSet.delete(t.template_id);
                                                    } else {
                                                        newSet.add(t.template_id);
                                                    }
                                                    setSelectedTemplateIds(newSet);
                                                }}
                                            />
                                            <span>{t.template_name}</span>
                                        </label>
                                    </div>
                                ))}
                            </div>
                            <button type="submit" className="w-full p-2 bg-blue-600 rounded-lg">Save Template</button>
                        </form>
                    </div>
                </div>
            )}

            {isInstanceModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                        <header className="flex justify-between items-center p-4 border-b border-slate-700">
                            <h2 className="text-xl font-bold">Initiate Onboarding</h2>
                            <button onClick={() => setIsInstanceModalOpen(false)}><XIcon c="w-6 h-6" /></button>
                        </header>
                        <form onSubmit={handleInitiateOnboarding} className="p-4 space-y-4">
                            <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="w-full bg-slate-700 p-2 text-sm rounded">
                                <option value="">-- Select User --</option>
                                {users.map(u => <option key={u['E-mail']} value={u['E-mail']}>{u.Name} {u.Surname}</option>)}
                            </select>
                            <select value={selectedOnboardingTemplate} onChange={e => setSelectedOnboardingTemplate(e.target.value)} className="w-full bg-slate-700 p-2 text-sm rounded">
                                <option value="">-- Select Onboarding Template --</option>
                                {onboardingTemplates.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}
                            </select>
                            <button type="submit" className="w-full p-2 bg-green-600 rounded-lg">Start Onboarding</button>
                        </form>
                    </div>
                </div>
            )}

            {isInstanceDetailModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl">
                        <header className="flex justify-between items-center p-4 border-b border-slate-700">
                            <h2 className="text-xl font-bold">Onboarding Details for {userMap[selectedInstance?.user_email] || selectedInstance?.user_email}</h2>
                            <button onClick={() => setIsInstanceDetailModalOpen(false)}><XIcon c="w-6 h-6" /></button>
                        </header>
                        <div className="p-4">
                            <div className="max-h-96 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-300 uppercase bg-slate-700 sticky top-0">
                                        <tr>
                                            <th scope="col" className="p-3">Access Template</th>
                                            <th scope="col" className="p-3">Status</th>
                                            <th scope="col" className="p-3">Issue Key</th>
                                            <th scope="col" className="p-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedInstance?.statuses.map(s => {
                                            const templateDetails = templates.find(t => t.template_id === s.template_id);
                                            const isManual = templateDetails ? templateDetails.is_manual : false;
                                            
                                            return (
                                                <tr key={s.template_id} className={`bg-slate-800 border-b border-slate-700 ${s.isLocked ? 'opacity-60' : ''}`}>
                                                    <td className="p-3">
                                                        <div className="flex items-center">
                                                            {s.isLocked && <LockIcon c="w-4 h-4 mr-2 text-yellow-400"/>}
                                                            <div>
                                                                <span className="font-semibold text-white">{s.template_name}</span>
                                                                {s.dependencies && s.dependencies.length > 0 && (
                                                                    <div className="text-xs text-slate-400 mt-1">
                                                                        Depends on: {s.dependencies.map(depId => templates.find(t => t.template_id === depId)?.template_name).join(', ')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3">{s.status}</td>
                                                    <td className="p-3">{s.issue_key || 'N/A'}</td>
                                                    <td className="p-3">
                                                        <div className="flex space-x-2">
                                                            {s.isLocked ? (
                                                                <button onClick={() => handleBypass(selectedInstance.id, s.template_id)} className="text-yellow-400 hover:text-yellow-300" title="Bypass Dependency">
                                                                    <UnlockIcon c="w-4 h-4" />
                                                                </button>
                                                            ) : (
                                                                (() => {
                                                                    if (isManual) {
                                                                        if (s.issue_key) {
                                                                            return (
                                                                                <>
                                                                                    <button onClick={() => openUpdateStatusModal(selectedInstance.id, s.template_id, s.status)} className="text-cyan-400 hover:text-cyan-300" title="Update Status">
                                                                                        <RefreshCwIcon c="w-4 h-4" />
                                                                                    </button>
                                                                                    <button onClick={() => handleUnassignTicket(selectedInstance.id, s.template_id, s.issue_key)} className="text-red-400 hover:text-red-300" title="Unassign Ticket">
                                                                                        <LinkOffIcon c="w-4 h-4" />
                                                                                    </button>
                                                                                </>
                                                                            );
                                                                        }
                                                                        if (s.status === 'Not Started') {
                                                                            return (
                                                                                <>
                                                                                    <button onClick={() => handleMarkAsComplete(selectedInstance.id, s.template_id)} className="text-green-400 hover:text-green-300" title="Mark as Complete"><CheckCircleIcon c="w-4 h-4" /></button>
                                                                                    <button onClick={() => openAssociateModal(selectedInstance.id, s.template_id, true)} className="text-gray-400 hover:text-gray-300" title="Associate Ticket"><LinkIcon c="w-4 h-4" /></button>
                                                                                </>
                                                                            );
                                                                        }
                                                                    } else if (s.status === 'Not Started') {
                                                                        return (
                                                                            <>
                                                                                <button onClick={() => handleExecuteRequest(selectedInstance.id, s.template_id)} className="text-blue-400 hover:text-blue-300" title="Submit Request"><SendIcon c="w-4 h-4" /></button>
                                                                                <button onClick={() => openAssociateModal(selectedInstance.id, s.template_id)} className="text-gray-400 hover:text-gray-300" title="Associate Ticket"><LinkIcon c="w-4 h-4" /></button>
                                                                            </>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {isAssociateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                        <header className="flex justify-between items-center p-4 border-b border-slate-700">
                            <h2 className="text-xl font-bold">Associate Existing Ticket</h2>
                            <button onClick={() => setIsAssociateModalOpen(false)}><XIcon c="w-6 h-6" /></button>
                        </header>
                        <form onSubmit={handleAssociateRequest} className="p-4 space-y-4">
                            <input
                                type="text"
                                placeholder="Enter Issue Key (e.g., PROJ-123)"
                                value={issueKey}
                                onChange={e => setIssueKey(e.target.value.toUpperCase())}
                                className="w-full bg-slate-700 p-2 text-sm rounded"
                                required
                            />
                            <button type="submit" className="w-full p-2 bg-purple-600 rounded-lg">Associate Ticket</button>
                        </form>
                    </div>
                </div>
            )}

            {isManualAssociateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                        <header className="flex justify-between items-center p-4 border-b border-slate-700">
                            <h2 className="text-xl font-bold">Manually Associate Ticket</h2>
                            <button onClick={() => setIsManualAssociateModalOpen(false)}><XIcon c="w-6 h-6" /></button>
                        </header>
                        <form onSubmit={handleManualAssociateRequest} className="p-4 space-y-4">
                            <input
                                type="text"
                                placeholder="Enter Issue Key (e.g., PROJ-123)"
                                value={manualIssueKey}
                                onChange={e => setManualIssueKey(e.target.value.toUpperCase())}
                                className="w-full bg-slate-700 p-2 text-sm rounded"
                                required
                            />
                            <input
                                type="text"
                                placeholder="Enter Ticket Status (e.g., In Progress)"
                                value={manualStatus}
                                onChange={e => setManualStatus(e.target.value)}
                                className="w-full bg-slate-700 p-2 text-sm rounded"
                                required
                            />
                            <button type="submit" className="w-full p-2 bg-purple-600 rounded-lg">Associate Ticket</button>
                        </form>
                    </div>
                </div>
            )}
            
            {isUpdateStatusModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                        <header className="flex justify-between items-center p-4 border-b border-slate-700">
                            <h2 className="text-xl font-bold">Update Manual Task Status</h2>
                            <button onClick={() => setIsUpdateStatusModalOpen(false)}><XIcon c="w-6 h-6" /></button>
                        </header>
                        <form onSubmit={handleUpdateStatus} className="p-4 space-y-4">
                            <p className="text-sm text-slate-400">Update the status for ticket <span className="font-bold text-slate-200">{associationInfo.issueKey}</span>.</p>
                            <input
                                type="text"
                                placeholder="Enter New Status"
                                value={newStatus}
                                onChange={e => setNewStatus(e.target.value)}
                                className="w-full bg-slate-700 p-2 text-sm rounded"
                                required
                            />
                            <button type="submit" className="w-full p-2 bg-cyan-600 rounded-lg">Update Status</button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};