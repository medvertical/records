import React from 'react';
import { cn } from '@/lib/utils';

interface CircularProgressProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
  strokeWidth?: number;
}

export function CircularProgress({ 
  value, 
  size = 'md', 
  showValue = true,
  className,
  strokeWidth
}: CircularProgressProps) {
  // Ensure value is between 0 and 100
  const percentage = Math.min(100, Math.max(0, value));
  
  // Size configurations
  const sizeConfig = {
    sm: { diameter: 40, fontSize: 'text-xs', strokeWidth: strokeWidth || 3 },
    md: { diameter: 48, fontSize: 'text-sm', strokeWidth: strokeWidth || 4 },
    lg: { diameter: 64, fontSize: 'text-base', strokeWidth: strokeWidth || 5 },
  };
  
  const config = sizeConfig[size];
  const radius = (config.diameter - config.strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  // Color based on percentage
  const getColor = (value: number) => {
    if (value >= 80) return 'rgb(34 197 94)'; // green-500
    if (value >= 60) return 'rgb(250 204 21)'; // yellow-400
    return 'rgb(239 68 68)'; // red-500
  };
  
  const color = getColor(percentage);
  
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={config.diameter}
        height={config.diameter}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={config.diameter / 2}
          cy={config.diameter / 2}
          r={radius}
          stroke="rgb(229 231 235)" // gray-200
          strokeWidth={config.strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={config.diameter / 2}
          cy={config.diameter / 2}
          r={radius}
          stroke={color}
          strokeWidth={config.strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-in-out"
        />
      </svg>
      {showValue && (
        <div className={cn(
          "absolute inset-0 flex items-center justify-center",
          config.fontSize,
          "font-medium"
        )}>
          <span style={{ color }}>{Math.round(percentage)}%</span>
        </div>
      )}
    </div>
  );
}