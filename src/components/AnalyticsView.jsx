import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { PROXY_ENDPOINT } from '../constants';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export const AnalyticsView = ({ log }) => {
    const [chartData, setChartData] = React.useState({ labels: [], datasets: [] });

    React.useEffect(() => {
        const fetchData = async () => {
            log('info', 'Fetching analytics...');
            try {
                const res = await fetch(`${PROXY_ENDPOINT}/analytics/time_spent`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                log('success', 'Analytics loaded.');

                const labels = data.map(d => d.request_type_name);
                const values = data.map(d => (d.avg_hours || 0).toFixed(2));

                setChartData({
                    labels,
                    datasets: [{
                        label: 'Average Time to Closure (Hours)',
                        data: values,
                        backgroundColor: 'rgba(59, 130, 246, 0.5)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1
                    }]
                });
            } catch (e) {
                log('error', `Could not load analytics: ${e.message}`);
            }
        };
        fetchData();
    }, []);

    const options = {
        indexAxis: 'y',
        elements: {
            bar: {
                borderWidth: 2,
            },
        },
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: '#cbd5e1'
                }
            },
            title: {
                display: true,
                text: 'Average Time to Closure by Request Type',
                color: '#cbd5e1'
            },
        },
        scales: {
            x: {
                ticks: { color: '#cbd5e1' },
                grid: { color: 'rgba(203, 213, 225, 0.1)' }
            },
            y: {
                ticks: { color: '#cbd5e1' },
                grid: { color: 'rgba(203, 213, 225, 0.1)' }
            }
        }
    };

    return (
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">Request Analytics</h2>
            <div className="p-4 bg-slate-900/50 rounded-lg">
                {chartData.labels.length > 0 ? (
                    <Bar options={options} data={chartData} />
                ) : (
                    <div className="text-center text-slate-500 py-8">No data available to display chart. Close some tickets to see analytics.</div>
                )}
            </div>
        </div>
    );
};
