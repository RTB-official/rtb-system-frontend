import { SpeechBubbleIcon } from "./icons";

interface WorkloadXAxisTickProps {
    x?: number;
    y?: number;
    payload?: { value?: string };
    hasReason: boolean;
}

export default function WorkloadXAxisTick({
    x = 0,
    y = 0,
    payload,
    hasReason,
}: WorkloadXAxisTickProps) {
    const name = payload?.value ?? "";

    return (
        <g transform={`translate(${x},${y})`}>
            <text
                x={0}
                y={0}
                dy={14}
                textAnchor="middle"
                fill="#6a7282"
                fontSize={12}
            >
                {name}
            </text>

            {hasReason && (
                <g transform="translate(22, 2)">
                    <SpeechBubbleIcon />
                </g>
            )}
        </g>
    );
}
