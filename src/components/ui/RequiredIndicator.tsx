interface RequiredIndicatorProps {
  className?: string;
}

export default function RequiredIndicator({
  className = "",
}: RequiredIndicatorProps) {
  return (
    <span className={`ml-1 text-red-500 text-[15px] ${className}`}>*</span>
  );
}
