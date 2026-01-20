// src/components/common/Avatar.tsx
type Props = {
    email?: string | null;
    size?: number; // px
    position?: string | null; // 직급
};

export default function Avatar({ email, size = 32, position }: Props) {
    const text = (() => {
        if (!email) return "U";
        const id = email.split("@")[0]; // mw.park
        return id.slice(0, 2).toLowerCase(); // mw
    })();

    const bgColor = (() => {
        switch (position) {
            case "인턴":
                return "#94A3B8"; // slate
            case "사원":
                return "#64748B"; // slate-500
            case "주임":
                return "#22C55E"; // green
            case "대리":
                return "#6366F1"; // indigo
            case "과장":
                return "#A855F7"; // purple
            case "차장":
                return "#efc404"; // yellow (노란색)
            case "부장":
                return "#EF4444"; // red
            case "감사":
                return "#0EA5E9"; // cyan (감사용)
            case "대표":
                return "#111827"; // almost black
            default:
                return "#F79009"; // fallback
        }
    })();


    return (
        <div
            className="rounded-full flex items-center justify-center text-white font-semibold uppercase"
            style={{
                width: size,
                height: size,
                fontSize: size * 0.5,
                backgroundColor: bgColor,
            }}
        >
            {text}
        </div>
    );
}
