import { cn } from "@/lib/utils";

interface AppIconProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function AppIcon({ size = "md", className }: AppIconProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  };

  return (
    <div 
      className={cn(
        "flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm",
        sizeClasses[size],
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5/6 w-5/6 text-white"
        fill="currentColor"
      >
        {/* Medical Record / Health Data Icon */}
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
        <path d="M14 2v6h6"/>
        <path d="M8 12h8"/>
        <path d="M8 16h8"/>
        <path d="M8 20h8"/>
        {/* Health/Medical Cross accent */}
        <circle cx="11" cy="9" r="1.5" fill="rgba(255,255,255,0.9)"/>
        <rect x="10.25" y="7.5" width="1.5" height="3" rx="0.75" fill="rgba(255,255,255,0.9)"/>
        <rect x="9.5" y="8.25" width="3" height="1.5" rx="0.75" fill="rgba(255,255,255,0.9)"/>
      </svg>
    </div>
  );
}