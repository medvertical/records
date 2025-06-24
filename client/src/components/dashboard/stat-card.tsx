import { Card, CardContent } from "@/components/ui/card";
import { 
  Database, 
  CheckCircle, 
  TriangleAlert, 
  Shield,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  color?: "default" | "success" | "error" | "warning";
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  subtitle?: string;
}

const iconMap = {
  "database": Database,
  "check-circle": CheckCircle,
  "exclamation-triangle": TriangleAlert,
  "shield-alt": Shield,
};

const colorMap = {
  default: {
    icon: "bg-fhir-blue/10 text-fhir-blue",
    value: "text-gray-900",
  },
  success: {
    icon: "bg-green-50 text-fhir-success",
    value: "text-fhir-success",
  },
  error: {
    icon: "bg-red-50 text-fhir-error",
    value: "text-fhir-error",
  },
  warning: {
    icon: "bg-orange-50 text-fhir-warning",
    value: "text-gray-900",
  },
};

export default function StatCard({ 
  title, 
  value, 
  icon, 
  color = "default", 
  trend, 
  subtitle 
}: StatCardProps) {
  const Icon = iconMap[icon as keyof typeof iconMap] || Database;
  const colors = colorMap[color];

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className={cn("text-3xl font-bold", colors.value)}>
              {value.toLocaleString()}
            </p>
          </div>
          <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", colors.icon)}>
            <Icon className="text-xl h-6 w-6" />
          </div>
        </div>
        {(trend || subtitle) && (
          <div className="mt-4 flex items-center text-sm">
            {trend && (
              <>
                <span className={cn(
                  "flex items-center",
                  trend.direction === "up" ? "text-fhir-success" : "text-fhir-error"
                )}>
                  {trend.direction === "up" ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {trend.value}%
                </span>
                {subtitle && <span className="text-gray-500 ml-2">{subtitle}</span>}
              </>
            )}
            {!trend && subtitle && (
              <span className="text-gray-500">{subtitle}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
