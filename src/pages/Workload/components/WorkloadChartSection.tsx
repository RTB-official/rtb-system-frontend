import type { RefObject } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Line,
    ReferenceLine,
    Label,
} from "recharts";
import type { WorkloadChartData } from "../../../lib/workloadApi";
import {
    BAR_RADIUS,
    CHART_MARGIN,
    WORKLOAD_TYPES,
    X_AXIS_HEIGHT,
    Y_AXIS_WIDTH,
} from "../workloadConstants";

type ChartSize = { width: number; height: number };

interface WorkloadChartSectionProps {
    chartData: WorkloadChartData[];
    chartDataWithLastWork: WorkloadChartData[];
    chartContainerRef: RefObject<HTMLDivElement | null>;
    chartSize: ChartSize;
    showLastMonth: boolean;
    onToggleLastMonth: () => void;
    onChartMouseMove: (state: any) => void;
    onChartMouseLeave: () => void;
    onChartClick: (state: any) => void;
    onBarClick: (barData: any) => void;
    CustomXAxisTick: (props: any) => JSX.Element;
    maxYValue: number;
    yAxisTicks: number[];
    averageWorkTime: number;
}

const CustomTooltip = ({ active, payload, label, showLastMonth }: any) => {
    if (active && payload && payload.length) {
        const byKey = (key: string) =>
            payload.find((p: any) => p?.dataKey === key)?.value ?? 0;

        const lastWork = byKey("lastWork");

        return (
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-lg">
                <p className="font-semibold text-sm text-gray-900 mb-2">{label}</p>
                <div className="flex flex-col gap-1.5">
                    {WORKLOAD_TYPES.map((type) => (
                        <div key={type.key} className="flex items-center gap-1.5">
                            <div
                                className="w-3.5 h-3.5 rounded"
                                style={{ backgroundColor: type.color }}
                            />
                            <span className="text-sm text-gray-600">
                                {type.label} {byKey(type.dataKey)}시간
                            </span>
                        </div>
                    ))}

                    {showLastMonth && (
                        <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-gray-100">
                            <div
                                className="w-3.5 h-3.5 rounded"
                                style={{ backgroundColor: "#d1d5db" }}
                            />
                            <span className="text-sm text-gray-600">
                                지난달 작업 {lastWork}시간
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
};

const CustomBarShape = (props: any) => {
    const { fill, x, y, width, height, payload, dataKey } = props;
    const { 작업, 이동, 대기 } = payload as WorkloadChartData;

    const isTopBar =
        (dataKey === "대기" && 대기 > 0) ||
        (dataKey === "이동" && 대기 === 0 && 이동 > 0) ||
        (dataKey === "작업" && 대기 === 0 && 이동 === 0 && 작업 > 0);

    if (isTopBar) {
        const path = `M ${x + BAR_RADIUS} ${y} 
                      L ${x + width - BAR_RADIUS} ${y} 
                      Q ${x + width} ${y} ${x + width} ${y + BAR_RADIUS} 
                      L ${x + width} ${y + height} 
                      L ${x} ${y + height} 
                      L ${x} ${y + BAR_RADIUS} 
                      Q ${x} ${y} ${x + BAR_RADIUS} ${y} Z`;
        return <path d={path} fill={fill} />;
    }

    return <rect x={x} y={y} width={width} height={height} fill={fill} />;
};

export default function WorkloadChartSection({
    chartData,
    chartDataWithLastWork,
    chartContainerRef,
    chartSize,
    showLastMonth,
    onToggleLastMonth,
    onChartMouseMove,
    onChartMouseLeave,
    onChartClick,
    onBarClick,
    CustomXAxisTick,
    maxYValue,
    yAxisTicks,
    averageWorkTime,
}: WorkloadChartSectionProps) {
    const hasData = chartData.length > 0;

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-7">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h2 className="text-[22px] font-semibold text-gray-700 tracking-tight">
                    인원별 작업시간
                </h2>

                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onToggleLastMonth}
                        className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition
                            ${showLastMonth
                                ? "bg-red-50 border-red-200 text-red-600"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                    >
                        지난달 데이터 {showLastMonth ? "ON" : "OFF"}
                    </button>

                    <div className="flex items-center gap-5">
                        {WORKLOAD_TYPES.map((type) => (
                            <div key={type.key} className="flex items-center gap-1.5">
                                <div
                                    className="w-4 h-4 rounded"
                                    style={{ backgroundColor: type.color }}
                                />
                                <span className="text-[13px] text-gray-500">
                                    {type.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {!hasData ? (
                <div className="h-[300px] flex items-center justify-center">
                    <div className="text-gray-500">데이터가 없습니다.</div>
                </div>
            ) : (
                <div
                    ref={chartContainerRef}
                    className="w-full"
                    style={{
                        height: "300px",
                        minHeight: "300px",
                        position: "relative",
                        width: "100%",
                    }}
                >
                    {chartSize.width > 0 ? (
                        <div className="relative w-full h-[300px]">
                            <div className="absolute inset-0">
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart
                                        data={chartDataWithLastWork}
                                        margin={CHART_MARGIN}
                                        onMouseMove={onChartMouseMove}
                                        onMouseLeave={onChartMouseLeave}
                                        onClick={onChartClick}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                            stroke="#e5e7eb"
                                        />
                                        <XAxis
                                            height={X_AXIS_HEIGHT}
                                            dataKey="name"
                                            tick={CustomXAxisTick}
                                            axisLine={false}
                                            tickLine={false}
                                        />

                                        <YAxis
                                            width={Y_AXIS_WIDTH}
                                            tick={{ fontSize: 14, fill: "#99a1af" }}
                                            axisLine={false}
                                            tickLine={false}
                                            domain={[0, maxYValue]}
                                            ticks={yAxisTicks}
                                        />
                                        <Tooltip
                                            content={<CustomTooltip showLastMonth={showLastMonth} />}
                                            cursor={{ fill: "rgba(0,0,0,0.05)" }}
                                        />

                                        {WORKLOAD_TYPES.map((type) => (
                                            <Bar
                                                key={type.key}
                                                dataKey={type.dataKey}
                                                stackId="a"
                                                fill={type.color}
                                                shape={CustomBarShape}
                                                onClick={onBarClick}
                                                cursor="pointer"
                                            />
                                        ))}

                                        <Line
                                            type="monotone"
                                            dataKey={() => averageWorkTime}
                                            stroke="#5c5c5c"
                                            strokeWidth={1}
                                            strokeDasharray="6 6"
                                            dot={false}
                                            activeDot={false}
                                            isAnimationActive={false}
                                        />

                                        <ReferenceLine y={averageWorkTime} stroke="transparent">
                                            <Label
                                                value={`평균 ${averageWorkTime}`}
                                                position="insideRight"
                                                offset={10}
                                                dy={-8}
                                                fill="#5c5c5c"
                                                fontSize={12}
                                                fontWeight={600}
                                            />
                                        </ReferenceLine>

                                        {showLastMonth && (
                                            <Line
                                                type="linear"
                                                dataKey="lastWork"
                                                stroke="#d1d5db"
                                                strokeWidth={2}
                                                dot={{ r: 4, fill: "#d1d5db" }}
                                                activeDot={{ r: 5 }}
                                                connectNulls={false}
                                                isAnimationActive={false}
                                            />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[300px] w-full bg-gray-100 rounded-xl animate-pulse" />
                    )}
                </div>
            )}
        </div>
    );
}
