export const structureTasksForDisplay = (tasks) => {
    if (!tasks || tasks.length === 0) {
        return [];
    }

    const taskMap = new Map(tasks.map(task => [task.template_id, { ...task, children: [] }]));

    // First, identify direct children for each task
    taskMap.forEach(task => {
        const dependencies = task.dependencies || [];
        dependencies.forEach(depId => {
            if (taskMap.has(depId)) {
                taskMap.get(depId).children.push(task.template_id);
            }
        });
    });

    // Identify all tasks that are children
    const allChildIds = new Set();
    taskMap.forEach(task => {
        task.children.forEach(childId => allChildIds.add(childId));
    });

    // Root nodes are tasks that are never a child of another task
    const rootNodes = Array.from(taskMap.values()).filter(task => !allChildIds.has(task.template_id));

    const displayList = [];

    // Recursive function to build the final flat list for rendering
    const buildList = (taskId, level, parentPath) => {
        const task = taskMap.get(taskId);
        if (!task) return;

        // --- THIS IS THE FIX ---
        // Create a key from the full path to guarantee uniqueness for each rendered instance.
        const uniqueRenderKey = `${parentPath}-${taskId}`;
        // --- END OF FIX ---

        // Add the task to the list with its level and a unique key for rendering
        displayList.push({ 
            ...task, 
            level, 
            uniqueRenderKey
        });
        
        // Sort children alphabetically before recursing
        task.children.sort((a, b) => {
            const nameA = taskMap.get(a)?.template_name || '';
            const nameB = taskMap.get(b)?.template_name || '';
            return nameA.localeCompare(nameB);
        }).forEach(childId => {
            // Pass the new unique key down to the next level
            buildList(childId, level + 1, uniqueRenderKey);
        });
    };

    // Start the process from the root nodes
    rootNodes.sort((a, b) => a.template_name.localeCompare(b.template_name)).forEach(root => {
        buildList(root.template_id, 0, 'root');
    });

    return displayList;
};