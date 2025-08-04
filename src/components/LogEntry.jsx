import React from 'react';
import { UserIcon, AlertTriangleIcon, SendIcon } from './Icons';

export const LogEntry = ({ type, message }) => { 
    const icons = { success: <UserIcon c="w-4 h-4 text-green-400" />, error: <AlertTriangleIcon c="w-4 h-4 text-red-400" />, info: <SendIcon c="w-4 h-4 text-blue-400" /> };
    const colors = { success: 'text-green-300', error: 'text-red-300', info: 'text-blue-300' };
    return (<div className="flex items-start p-1 border-b border-slate-800 text-xs"><div className="flex-shrink-0 mr-2 mt-0.5">{icons[type]}</div><pre className={`flex-grow ${colors[type]} whitespace-pre-wrap break-all`}>{message}</pre></div>);
};