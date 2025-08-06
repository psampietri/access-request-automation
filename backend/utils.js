export const formatJiraPayload = (fieldMappings, user) => {
    const requestFieldValues = {};

    for (const [fieldId, mapping] of Object.entries(fieldMappings)) {
        let value;
        if (mapping.type === 'dynamic') {
            value = user[mapping.value];
        } else {
            value = mapping.value;
        }

        // Helper function to determine if a value looks like an ID
        const isNumeric = (val) => !isNaN(parseFloat(val)) && isFinite(val);

        if (mapping.jiraSchema) {
            const { type, items } = mapping.jiraSchema;

            if (type === 'array' && items === 'user') {
                // Multi-user picker
                requestFieldValues[fieldId] = Array.isArray(value) ? value.map(v => ({ name: v })) : [{ name: value }];
            } else if (type === 'user') {
                // Single-user picker
                requestFieldValues[fieldId] = { name: value };
            } else if (type === 'array' && items === 'option') {
                // Multi-select list: send an object with 'id' if numeric, otherwise 'value'
                const values = Array.isArray(value) ? value : [value];
                requestFieldValues[fieldId] = values.map(v => (isNumeric(v) ? { id: v.toString() } : { value: v }));
            } else if (type === 'option') {
                // Single-select list: send an object with 'id' if numeric, otherwise 'value'
                requestFieldValues[fieldId] = isNumeric(value) ? { id: value.toString() } : { value: value };
            } else if (type === 'array') {
                // Other array types
                requestFieldValues[fieldId] = Array.isArray(value) ? value : [value];
            } else {
                // All other field types
                requestFieldValues[fieldId] = value;
            }
        } else {
            // Fallback for older templates without a schema
            requestFieldValues[fieldId] = value;
        }
    }
    return requestFieldValues;
};