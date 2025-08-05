import React from 'react';
import { PROXY_ENDPOINT } from '../constants';
import { TrashIcon, EditIcon } from './Icons';
import { safeFetch } from '../utils/fetch'; // Import the new function

export const TemplatesView = ({ log, templates, fetchTemplates, userFields }) => {
    const [editingTemplate, setEditingTemplate] = React.useState(null);
    const [serviceDesks, setServiceDesks] = React.useState([]);
    const [requestTypes, setRequestTypes] = React.useState([]);
    const [fields, setFields] = React.useState([]);
    const [selectedServiceDesk, setSelectedServiceDesk] = React.useState({ id: '', name: '' });
    const [selectedRequestType, setSelectedRequestType] = React.useState({ id: '', name: '' });
    const [templateName, setTemplateName] = React.useState('');
    const [fieldMappings, setFieldMappings] = React.useState({});

    React.useEffect(() => {
        const fetch = async () => {
            const data = await safeFetch(`${PROXY_ENDPOINT}/jira/servicedesks`, log, 'Failed to fetch Service Desks');
            if (data) setServiceDesks(data.values);
        };
        fetch();
    }, [log]);

    React.useEffect(() => {
        if (selectedServiceDesk.id) {
            const fetch = async () => {
                setRequestTypes([]);
                setSelectedRequestType({ id: '', name: '' });
                setFields([]);
                const data = await safeFetch(`${PROXY_ENDPOINT}/jira/servicedesks/${selectedServiceDesk.id}/requesttypes`, log, 'Failed to fetch Request Types');
                if (data) setRequestTypes(data.values);
            };
            fetch();
        }
    }, [selectedServiceDesk.id, log]);

    React.useEffect(() => {
        if (selectedRequestType.id) {
            const fetch = async () => {
                const data = await safeFetch(`${PROXY_ENDPOINT}/jira/servicedesks/${selectedServiceDesk.id}/requesttypes/${selectedRequestType.id}/fields`, log, 'Failed to fetch fields');
                if (data && data.requestTypeFields) {
                    setFields(data.requestTypeFields);
                    const initialMappings = {};
                    data.requestTypeFields.filter(f => f.required).forEach(field => {
                        initialMappings[field.fieldId] = { type: 'dynamic', value: userFields[0] };
                    });
                    setFieldMappings(initialMappings);
                } else {
                    setFields([]);
                    setFieldMappings({});
                }
            };
            fetch();
        }
    }, [selectedRequestType.id, selectedServiceDesk.id, log, userFields]);

    // ... The rest of the component remains the same
    const handleMappingChange = (fieldId, type, value) => {
        setFieldMappings(prev => ({ ...prev, [fieldId]: { type, value } }));
    };

    const handleSaveTemplate = async (e) => {
        e.preventDefault();
        if (!templateName || !selectedRequestType.id) {
            log('error', 'Please provide a template name and select a request type.');
            return;
        }
        const payload = {
            template_name: templateName,
            service_desk_id: selectedServiceDesk.id,
            request_type_id: selectedRequestType.id,
            service_desk_name: selectedServiceDesk.name,
            request_type_name: selectedRequestType.name,
            field_mappings: fieldMappings
        };
        const url = editingTemplate ? `${PROXY_ENDPOINT}/templates/${editingTemplate.template_id}` : `${PROXY_ENDPOINT}/templates`;
        const method = editingTemplate ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            log('success', `Template ${editingTemplate ? 'updated' : 'saved'}!`);
            fetchTemplates();
            cancelEditing();
        } catch (error) {
            log('error', `Could not save template: ${error.message}`);
        }
    };

    const handleDeleteTemplate = async (templateId) => {
        if (confirm('Are you sure you want to delete this template?')) {
            try {
                const res = await fetch(`${PROXY_ENDPOINT}/templates/${templateId}`, { method: 'DELETE' });
                if (!res.ok) throw new Error((await res.json()).error);
                log('info', 'Template deleted.');
                fetchTemplates();
            } catch (e) {
                log('error', `Failed to delete template: ${e.message}`);
            }
        }
    };

    const startEditing = (template) => {
        setEditingTemplate(template);
        setTemplateName(template.template_name);
        setSelectedServiceDesk({ id: template.service_desk_id, name: template.service_desk_name });
        setSelectedRequestType({ id: template.request_type_id, name: template.request_type_name });
        setFieldMappings(JSON.parse(template.field_mappings));
    };

    const cancelEditing = () => {
        setEditingTemplate(null);
        setTemplateName('');
        setFieldMappings({});
        setFields([]);
        setSelectedRequestType({ id: '', name: '' });
        setSelectedServiceDesk({ id: '', name: '' });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                    <h2 className="text-xl font-semibold mb-4">{editingTemplate ? 'Edit Template' : '1. Create New Template'}</h2>
                    <form className="space-y-4" onSubmit={handleSaveTemplate}>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm block mb-1">Service Desk</label>
                                <select onChange={(e) => setSelectedServiceDesk({ id: e.target.value, name: e.target.options[e.target.selectedIndex].text })} value={selectedServiceDesk.id} className="w-full bg-slate-700 p-2 text-sm rounded">
                                    <option value="">-- Select --</option>
                                    {serviceDesks.map(sd => <option key={sd.id} value={sd.id}>{sd.projectName}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm block mb-1">Request Type</label>
                                <select onChange={(e) => setSelectedRequestType({ id: e.target.value, name: e.target.options[e.target.selectedIndex].text })} value={selectedRequestType.id} disabled={!selectedServiceDesk.id} className="w-full bg-slate-700 p-2 text-sm rounded disabled:opacity-50">
                                    <option value="">-- Select --</option>
                                    {requestTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                                </select>
                            </div>
                        </div>
                        {fields.length > 0 && (
                            <div className="space-y-3 pt-4 border-t border-slate-700">
                                <h3 className="text-lg font-semibold">2. Map Form Fields</h3>
                                <div className="max-h-60 overflow-y-auto space-y-3 pr-2">
                                    {fields.filter(f => f.required).map(field => {
                                        const mapping = fieldMappings[field.fieldId] || { type: 'dynamic', value: userFields[0] };
                                        const hasValidValues = field.validValues && field.validValues.length > 0;
                                        const isMultiSelect = field.jiraSchema?.type === 'array';
                                        return (
                                            <div key={field.fieldId} className="grid grid-cols-3 gap-2 items-center">
                                                <label className="text-sm text-slate-300 truncate" title={field.name}>{field.name}</label>
                                                <select value={mapping.type} onChange={(e) => handleMappingChange(field.fieldId, e.target.value, e.target.value === 'dynamic' ? userFields[0] : (hasValidValues ? field.validValues[0].value : ''))} className="col-span-1 bg-slate-600 p-1 text-xs rounded">
                                                    <option value="dynamic">Dynamic</option>
                                                    <option value="static">Static Value</option>
                                                </select>
                                                {mapping.type === 'dynamic' ? (
                                                    <select value={mapping.value} onChange={(e) => handleMappingChange(field.fieldId, 'dynamic', e.target.value)} className="col-span-1 bg-slate-700 p-1 text-xs rounded">
                                                        {userFields.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                                    </select>
                                                ) : (
                                                    hasValidValues ? (
                                                        isMultiSelect ? (
                                                            <select multiple value={mapping.value || []} onChange={(e) => { const values = Array.from(e.target.selectedOptions, option => option.value); handleMappingChange(field.fieldId, 'static', values); }} className="col-span-1 bg-slate-700 p-1 text-xs rounded h-20">
                                                                {field.validValues.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                            </select>
                                                        ) : (
                                                            <select value={mapping.value} onChange={(e) => handleMappingChange(field.fieldId, 'static', e.target.value)} className="col-span-1 bg-slate-700 p-1 text-xs rounded">
                                                                {field.validValues.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                            </select>
                                                        )
                                                    ) : (
                                                        <input type="text" value={mapping.value || ''} onChange={(e) => handleMappingChange(field.fieldId, 'static', e.target.value)} placeholder="Enter static value" className="col-span-1 bg-slate-700 p-1 text-xs rounded" />
                                                    )
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="pt-4 border-t border-slate-700">
                                    <h3 className="text-lg font-semibold">3. Save Template</h3>
                                    <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Enter Template Name" className="w-full bg-slate-700 p-2 text-sm rounded mt-2" required />
                                    <div className="flex space-x-2 mt-2">
                                        <button type="submit" className="flex-1 p-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700">{editingTemplate ? 'Update Template' : 'Save Template'}</button>
                                        {editingTemplate && <button type="button" onClick={cancelEditing} className="flex-1 p-2 bg-slate-600 rounded">Cancel</button>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                <h2 className="text-xl font-semibold mb-4">Existing Templates</h2>
                <div className="max-h-[32rem] overflow-y-auto">
                    {templates.map(t => (
                        <div key={t.template_id} className="p-3 border-b border-slate-700 flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-white">{t.template_name}</p>
                                <p className="text-xs text-slate-400">{t.service_desk_name} / {t.request_type_name}</p>
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={() => startEditing(t)} className="text-slate-400 hover:text-blue-400"><EditIcon c="w-4 h-4"/></button>
                                <button onClick={() => handleDeleteTemplate(t.template_id)} className="text-slate-400 hover:text-red-400"><TrashIcon c="w-4 h-4"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};