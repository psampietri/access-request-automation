export const sortTasksByDependency = (tasks) => {
    if (!tasks || tasks.length === 0) {
        return [];
    }

    const taskMap = new Map(tasks.map(task => [task.template_id, { ...task, children: [], level: 0 }]));
    const topLevelTasks = [];

    // Build the graph and identify parent-child relationships
    tasks.forEach(task => {
        const deps = task.dependencies || [];
        if (deps.length === 0) {
            topLevelTasks.push(task.template_id);
        } else {
            deps.forEach(depId => {
                const parent = taskMap.get(depId);
                if (parent) {
                    parent.children.push(task.template_id);
                }
            });
        }
    });

    const sortedList = [];
    const visited = new Set();
    
    // Recursive function to perform the sort and set indentation levels
    const visit = (taskId, level) => {
        if (visited.has(taskId)) return; // Prevents infinite loops from circular dependencies
        visited.add(taskId);

        const taskNode = taskMap.get(taskId);
        if (taskNode) {
            taskNode.level = level;
            sortedList.push(taskNode);
            
            taskNode.children.sort((a, b) => { // Optional: sort children alphabetically
                const nameA = taskMap.get(a)?.template_name || '';
                const nameB = taskMap.get(b)?.template_name || '';
                return nameA.localeCompare(nameB);
            }).forEach(childId => {
                visit(childId, level + 1);
            });
        }
    };
    
    // Sort top-level tasks alphabetically before starting the traversal
    topLevelTasks.sort((a, b) => {
        const nameA = taskMap.get(a)?.template_name || '';
        const nameB = taskMap.get(b)?.template_name || '';
        return nameA.localeCompare(nameB);
    }).forEach(taskId => visit(taskId, 0));
    
    // Add any remaining nodes that might have been part of a cycle or orphaned
    taskMap.forEach((taskNode, taskId) => {
        if (!visited.has(taskId)) {
            sortedList.push(taskNode);
        }
    });

    return sortedList;
};