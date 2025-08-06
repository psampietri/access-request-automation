import React from 'react';

export const SparklineProgress = ({ closed, inProgress, total }) => {
    // Calculate percentages for each segment
    const closedPercentage = total > 0 ? (closed / total) * 100 : 0;
    const inProgressPercentage = total > 0 ? (inProgress / total) * 100 : 0;

    // Calculate the overall progress percentage for the tooltip
    const totalPercentage = closedPercentage + inProgressPercentage;

    const tooltipText = `Progress: ${totalPercentage.toFixed(0)}% (${closed} Closed, ${inProgress} In Progress, ${total - closed - inProgress} Not Started)`;

    return (
        <div 
            className="w-full bg-slate-700 rounded-full h-2.5 flex overflow-hidden" 
            title={tooltipText}
        >
            {/* Green segment for "Closed" tasks */}
            <div
                className="bg-green-500 h-2.5"
                style={{ width: `${closedPercentage}%` }}
            ></div>
            {/* Yellow segment for "In Progress" tasks */}
            <div
                className="bg-yellow-500 h-2.5"
                style={{ width: `${inProgressPercentage}%` }}
            ></div>
        </div>
    );
};