import { SpeechBubbleIcon } from "./icons";

interface WorkloadXAxisTickProps {
    x?: number;
    y?: number;
    payload?: { value?: string };
    hasReason: boolean;
    isMobile?: boolean;
}

export default function WorkloadXAxisTick({
    x = 0,
    y = 0,
    payload,
    hasReason,
    isMobile = false,
}: WorkloadXAxisTickProps) {
    const name = payload?.value ?? "";
    const fontSize = isMobile ? 10 : 12;

    return (
        <g transform={`translate(${x},${y})`}>
            <text
                x={0}
                y={0}
                dy={14}
                textAnchor="middle"
                fill="#6a7282"
                fontSize={fontSize}
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
