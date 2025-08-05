import React from 'react';
import { useAppData } from './hooks/useAppData';
import { HistoryView } from './components/HistoryView';
import { AnalyticsView } from './components/AnalyticsView';
import { TemplatesView } from './components/TemplatesView';
import { ExecuteTemplateView } from './components/ExecuteTemplateView';
import { UserManagementView } from './components/UserManagementView';
import { LogEntry } from './components/LogEntry';
import { SendIcon, FileTextIcon, UsersIcon, HistoryIcon, BarChartIcon } from './components/Icons';

export default function App() {
    const [activeView, setActiveView] = React.useState('execute');
    const [logs, setLogs] = React.useState([]);
    
    const log = React.useCallback((type, message) => {
        setLogs(prev => [{ type, message, id: Date.now() + Math.random() }, ...prev.slice(0, 100)]);
    }, []);

    const { users, userFields, templates, history, jiraBaseUrl, fetchUsers, fetchUserFields, fetchTemplates, fetchHistory } = useAppData(log);

    const TabButton = ({ viewName, icon, children }) => (
        <button 
            onClick={() => setActiveView(viewName)} 
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeView === viewName ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
        >
            {icon}{children}
        </button>
    );

    return (
        <div className="bg-slate-900 text-slate-200 min-h-screen font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-6">
                    <h1 className="text-4xl font-bold text-white">Access Request Automation Tool</h1>
                    <p className="text-slate-400 mt-2">Create, track, and analyze your Jira Service Desk requests.</p>
                </header>
                
                <div className="flex justify-center mb-6">
                    <div className="flex space-x-2 p-1 bg-slate-800 rounded-lg">
                        <TabButton viewName="execute" icon={<SendIcon c="w-5 h-5 mr-2" />}>Execute</TabButton>
                        <TabButton viewName="templates" icon={<FileTextIcon c="w-5 h-5 mr-2" />}>Templates</TabButton>
                        <TabButton viewName="users" icon={<UsersIcon c="w-5 h-5 mr-2" />}>Users</TabButton>
                        <TabButton viewName="history" icon={<HistoryIcon c="w-5 h-5 mr-2" />}>History</TabButton>
                        <TabButton viewName="analytics" icon={<BarChartIcon c="w-5 h-5 mr-2" />}>Analytics</TabButton>
                    </div>
                </div>
                
                <div className="mb-6">
                    {activeView === 'execute' && <ExecuteTemplateView log={log} users={users} templates={templates} />}
                    {activeView === 'templates' && <TemplatesView log={log} templates={templates} fetchTemplates={fetchTemplates} userFields={userFields} />}
                    {activeView === 'users' && <UserManagementView log={log} users={users} userFields={userFields} fetchUsers={fetchUsers} fetchUserFields={fetchUserFields} />}
                    {activeView === 'history' && <HistoryView log={log} history={history} jiraBaseUrl={jiraBaseUrl} fetchHistory={fetchHistory} />}
                    {activeView === 'analytics' && <AnalyticsView log={log} />}
                </div>

                <div className="w-full bg-slate-800/50 p-2 rounded-lg border border-slate-700 h-40 flex flex-col">
                    <h2 className="text-lg font-semibold mb-2 flex-shrink-0 px-2">Log</h2>
                    <div className="flex-grow bg-slate-900/70 rounded-md p-1 overflow-y-auto">
                        {logs.length === 0 && <div className="text-slate-500 text-xs text-center pt-2">Logs will appear here...</div>}
                        {logs.map(l => <LogEntry key={l.id} type={l.type} message={l.message} />)}
                    </div>
                </div>
            </div>
        </div>
    );
}