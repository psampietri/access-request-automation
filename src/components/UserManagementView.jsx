import React from 'react';
import { PROXY_ENDPOINT } from '../constants';
import { TrashIcon, EditIcon, XIcon } from './Icons';

export const UserManagementView = ({ log, users, userFields, fetchUsers, fetchUserFields }) => {
    const [editingUser, setEditingUser] = React.useState(null);
    const [newFieldName, setNewFieldName] = React.useState('');
    const [isUserModalOpen, setIsUserModalOpen] = React.useState(false);
    const [isFieldModalOpen, setIsFieldModalOpen] = React.useState(false);

    const handleSaveUser = async (e) => {
        e.preventDefault();
        const newUser = Object.fromEntries(new FormData(e.target).entries());
        try {
            const res = await fetch(editingUser ? `${PROXY_ENDPOINT}/users/${editingUser['E-mail']}` : `${PROXY_ENDPOINT}/users`, {
                method: editingUser ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            if (!res.ok) throw new Error(`Server responded with ${res.status}`);
            log('success', `User ${newUser.Name} saved successfully.`);
            fetchUsers();
            setEditingUser(null);
            setIsUserModalOpen(false);
        } catch (error) {
            log('error', `Error saving user: ${error.message}`);
        }
    };

    const handleDeleteUser = async (email) => {
        if (confirm('Are you sure?')) {
            try {
                const res = await fetch(`${PROXY_ENDPOINT}/users/${email}`, { method: 'DELETE' });
                if (!res.ok) throw new Error(`Server responded with ${res.status}`);
                log('info', `User ${email} deleted.`);
                fetchUsers();
            } catch (error) {
                log('error', `Error deleting user: ${error.message}`);
            }
        }
    };

    const handleAddField = async (e) => {
        e.preventDefault();
        if (!newFieldName) return;
        try {
            const res = await fetch(`${PROXY_ENDPOINT}/user-fields`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field_name: newFieldName })
            });
            if (!res.ok) throw new Error((await res.json()).error);
            log('success', `Field '${newFieldName}' added.`);
            fetchUserFields();
            setNewFieldName('');
            setIsFieldModalOpen(false);
        } catch (e) {
            log('error', `Failed to add field: ${e.message}`);
        }
    };

    const handleDeleteField = async (fieldName) => {
        if (confirm(`Delete field '${fieldName}'? This cannot be undone.`)) {
            try {
                const res = await fetch(`${PROXY_ENDPOINT}/user-fields/${fieldName}`, { method: 'DELETE' });
                if (!res.ok) throw new Error((await res.json()).error);
                log('info', `Field '${fieldName}' removed.`);
                fetchUserFields();
            } catch (e) {
                log('error', `Failed to delete field: ${e.message}`);
            }
        }
    };

    const openAddUserModal = () => {
        setEditingUser(null);
        setIsUserModalOpen(true);
    };

    const openEditUserModal = (user) => {
        setEditingUser(user);
        setIsUserModalOpen(true);
    };

    return (
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">User Database</h2>
                <div className="flex space-x-2">
                    <button onClick={openAddUserModal} className="flex items-center px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Add New User</button>
                    <button onClick={() => setIsFieldModalOpen(true)} className="flex items-center px-3 py-2 text-sm font-semibold text-white bg-gray-600 rounded-lg hover:bg-gray-700">Manage Fields</button>
                </div>
            </div>
            <div className="max-h-[32rem] overflow-y-auto border border-slate-700 rounded-md">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-300 uppercase bg-slate-700 sticky top-0">
                        <tr>
                            {userFields.map(f => <th key={f} scope="col" className="p-3">{f}</th>)}
                            <th scope="col" className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user['E-mail']} className="bg-slate-800 border-b border-slate-700">
                                {userFields.map(f => <td key={f} className="p-3 truncate max-w-xs">{user[f]}</td>)}
                                <td className="p-3 flex space-x-2">
                                    <button onClick={() => openEditUserModal(user)}><EditIcon c="w-4 h-4"/></button>
                                    <button onClick={() => handleDeleteUser(user['E-mail'])}><TrashIcon c="w-4 h-4"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isUserModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md flex flex-col">
                        <header className="flex justify-between items-center p-4 border-b border-slate-700">
                            <h2 className="text-xl font-bold">{editingUser ? 'Edit User' : 'Add New User'}</h2>
                            <button onClick={() => setIsUserModalOpen(false)}><XIcon c="w-6 h-6" /></button>
                        </header>
                        <div className="p-4">
                            <form onSubmit={handleSaveUser} className="space-y-3">
                                {userFields.map(field => (
                                    <div key={field}>
                                        <label className="text-sm text-slate-400 block mb-1">{field}</label>
                                        <input type="text" name={field} defaultValue={editingUser ? editingUser[field] : ''} required={['Name', 'Surname', 'E-mail'].includes(field)} readOnly={editingUser && field === 'E-mail'} className={`w-full bg-slate-700 p-2 text-sm rounded ${editingUser && field === 'E-mail' ? 'opacity-50' : ''}`} />
                                    </div>
                                ))}
                                <div className="flex space-x-2 pt-2">
                                    <button type="submit" className="flex-1 p-2 bg-green-600 rounded">{editingUser ? 'Save Changes' : 'Add User'}</button>
                                    <button type="button" onClick={() => setIsUserModalOpen(false)} className="flex-1 p-2 bg-slate-600 rounded">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {isFieldModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md flex flex-col">
                        <header className="flex justify-between items-center p-4 border-b border-slate-700">
                            <h2 className="text-xl font-bold">Manage Database Fields</h2>
                            <button onClick={() => setIsFieldModalOpen(false)}><XIcon c="w-6 h-6" /></button>
                        </header>
                        <div className="p-4">
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 mb-4">
                                {userFields.map(field => (
                                    <div key={field} className="flex justify-between items-center bg-slate-700/50 p-2 rounded">
                                        <span className="text-sm">{field}</span>
                                        {field !== 'E-mail' && <button onClick={() => handleDeleteField(field)}><TrashIcon c="w-4 h-4 text-slate-400 hover:text-red-400"/></button>}
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleAddField} className="flex space-x-2 mt-4 border-t border-slate-700 pt-4">
                                <input type="text" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="New Field Name" className="flex-grow bg-slate-700 p-2 text-sm rounded" required />
                                <button type="submit" className="p-2 bg-blue-600 rounded">Add Field</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
