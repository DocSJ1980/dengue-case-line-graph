import { useState, useEffect, useRef } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';

interface DataItem {
    name: string;
    confirmation_date: string;
    value: number;
}

interface ChartDataPoint {
    date: string;
    [key: string]: string | number;
}

interface ProcessedData {
    chartData: ChartDataPoint[];
    uniqueUCs: string[];
}

const COLORS = [
    '#2196F3', '#FF5722', '#4CAF50', '#9C27B0', '#FF9800',
    '#E91E63', '#00BCD4', '#8BC34A', '#673AB7', '#FFC107',
];

const generateDateRange = (startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
};

const formatDate = (dateString: string): string => {
    const [month, day, year] = dateString.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const calculateSimpleMovingAverage = (data: number[]): number[] => {
    const movingAverage: number[] = [];

    for (let i = 0; i < data.length; i++) {
        if (i < 13) {
            movingAverage.push(data[i]);
        } else {
            const slice = data.slice(i - 13, i + 1);
            const sum = slice.reduce((acc, val) => acc + val, 0);
            movingAverage.push(sum / slice.length);
        }
    }

    return movingAverage;
};

export default function LineGraphVisualization() {
    const [data, setData] = useState<ProcessedData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [topN, setTopN] = useState<number>(10);
    const [playbackSpeed] = useState<number>(70);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [selectedUCs, setSelectedUCs] = useState<string[]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Get animated data based on currentIndex
    const getAnimatedData = () => {
        if (!data) return [];
        return data.chartData.slice(0, currentIndex + 1);
    };

    // Animation effect
    useEffect(() => {
        if (isPlaying && data) {
            intervalRef.current = setInterval(() => {
                setCurrentIndex((prevIndex) => {
                    if (prevIndex >= data.chartData.length - 1) {
                        setIsPlaying(false);
                        return data.chartData.length - 1;
                    }
                    return prevIndex + 1;
                });
            }, playbackSpeed);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isPlaying, playbackSpeed, data]);

    // Data fetching effect
    useEffect(() => {
        fetch('/data.json')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then((jsonData: DataItem[]) => {
                const uniqueUCs = [...new Set(jsonData.map(item => item.name))];
                const startDate = '2024-07-01';
                const endDate = new Date().toISOString().split('T')[0];
                const dateRange = generateDateRange(startDate, endDate);

                // ... rest of the code ...


                // ... rest of the code ...
                const dataLookup = new Map<string, number>();
                jsonData.forEach(item => {
                    const formattedDate = formatDate(item.confirmation_date);
                    const key = `${item.name}-${formattedDate}`;
                    dataLookup.set(key, Number(item.value));
                });

                const ucTotals = uniqueUCs.map(uc => ({
                    name: uc,
                    total: dateRange.reduce((sum, date) => {
                        const key = `${uc}-${date}`;
                        return sum + (dataLookup.get(key) || 0);
                    }, 0)
                }));

                const topUCs = ucTotals
                    .sort((a, b) => b.total - a.total)
                    .slice(0, topN)
                    .map(uc => uc.name);

                const formattedData = dateRange.map(date => {
                    const dataPoint: ChartDataPoint = { date };
                    topUCs.forEach(uc => {
                        const key = `${uc}-${date}`;
                        dataPoint[uc] = dataLookup.get(key) || 0;
                    });
                    return dataPoint;
                });

                topUCs.forEach((uc) => {
                    const ucData = formattedData.map(point => point[uc] as number);
                    const movingAverage = calculateSimpleMovingAverage(ucData);
                    formattedData.forEach((point, index) => {
                        point[uc] = movingAverage[index];
                    });
                });

                setData({ chartData: formattedData, uniqueUCs: topUCs });
                setCurrentIndex(formattedData.length - 1); // Start with full data visible
            })
            .catch(error => {
                console.error('Error loading data:', error);
                setError(error.message);
            });
    }, [topN]);

    const toggleUCSelection = (uc: string) => {
        setSelectedUCs(prevSelected =>
            prevSelected.includes(uc)
                ? prevSelected.filter(name => name !== uc)
                : [...prevSelected, uc]
        );
    };

    const displayedUCs = selectedUCs.length ? selectedUCs : data?.uniqueUCs || [];

    const resetAnimation = () => {
        setIsPlaying(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        setCurrentIndex(0);
    };

    const togglePlay = () => {
        if (isPlaying) {
            setIsPlaying(false);
        } else {
            // If we're at the end, reset to start
            if (currentIndex >= (data?.chartData.length || 0) - 1) {
                setCurrentIndex(0);
            }
            setIsPlaying(true);
        }
    };

    if (error) return <div>Error loading data: {error}</div>;
    if (!data) return <div>Loading data...</div>;

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <span>Patient Data Line Graph</span>
                    <select
                        className="px-3 py-1 border rounded"
                        value={topN}
                        onChange={(e) => setTopN(Number(e.target.value))}
                    >
                        <option value="5">Top 5</option>
                        <option value="10">Top 10</option>
                        <option value="15">Top 15</option>
                        <option value="20">Top 20</option>
                    </select>
                </CardTitle>
            </CardHeader>

            <CardContent>
                <div className="flex flex-wrap mb-4 space-x-2">
                    {data.uniqueUCs.map((uc) => (
                        <button
                            key={uc}
                            onClick={() => toggleUCSelection(uc)}
                            className={`px-3 py-1 my-2 rounded ${selectedUCs.includes(uc) ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'
                                }`}
                        >
                            {uc}
                        </button>
                    ))}
                </div>

                <div className="flex justify-center space-x-4 mb-4">
                    <button
                        onClick={togglePlay}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button
                        onClick={resetAnimation}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                        Reset
                    </button>
                </div>

                <div className="h-[600px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={getAnimatedData()}
                            margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(date: string) =>
                                    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                }
                                interval={30}
                            />
                            <YAxis domain={[0, 12]} tickCount={7} interval="preserveStartEnd" />
                            <Tooltip
                                labelFormatter={(date: string) =>
                                    new Date(date).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })
                                }
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    borderRadius: '4px',
                                    padding: '10px',
                                    border: '1px solid #ddd'
                                }}
                            />
                            <Legend
                                layout="horizontal"
                                verticalAlign="bottom"
                                align="center"
                                wrapperStyle={{
                                    paddingTop: '20px',
                                    maxWidth: '100%',
                                    overflowX: 'auto'
                                }}
                            />
                            {displayedUCs.map((uc, index) => (
                                <Line
                                    key={uc}
                                    type="monotone"
                                    dataKey={uc}
                                    name={uc}
                                    stroke={COLORS[index % COLORS.length]}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}