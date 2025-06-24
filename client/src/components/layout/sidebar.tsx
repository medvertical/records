import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { 
  Database, 
  ChartPie, 
  CheckCircle, 
  Settings, 
  HospitalIcon,
  Users,
  Activity,
  Calendar,
  FileText
} from "lucide-react";

interface ServerStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

const navigationItems = [
  { href: "/", label: "Dashboard", icon: ChartPie },
  { href: "/resources", label: "Browse Resources", icon: Database },
  { href: "/validation", label: "Validation Profiles", icon: CheckCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

const quickAccessItems = [
  { href: "/resources?type=Patient", label: "Patients", resourceType: "Patient" },
  { href: "/resources?type=Observation", label: "Observations", resourceType: "Observation" },
  { href: "/resources?type=Encounter", label: "Encounters", resourceType: "Encounter" },
  { href: "/resources?type=Condition", label: "Conditions", resourceType: "Condition" },
];

export default function Sidebar() {
  const [location] = useLocation();
  
  const { data: serverStatus } = useQuery<ServerStatus>({
    queryKey: ["/api/fhir/connection/test"],
    refetchInterval: 30000,
  });

  const { data: resourceCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/fhir/resource-counts"],
  });

  return (
    <aside className="w-64 bg-white shadow-lg flex-shrink-0">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-fhir-blue rounded-lg flex items-center justify-center">
            <HospitalIcon className="text-white text-sm h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">FHIR Browser</h1>
            <p className="text-xs text-gray-500">Resource Validator</p>
          </div>
        </div>
      </div>

      {/* Server Connection Status */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Server Connection</span>
          <div className="flex items-center space-x-1">
            <div className={cn(
              "w-2 h-2 rounded-full",
              serverStatus?.connected ? "bg-fhir-success" : "bg-fhir-error"
            )} />
            <span className={cn(
              "text-xs",
              serverStatus?.connected ? "text-fhir-success" : "text-fhir-error"
            )}>
              {serverStatus?.connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          https://server.fire.ly
        </div>
        <button className="mt-2 text-xs text-fhir-blue hover:text-blue-700 font-medium">
          Change Server
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || 
              (item.href === "/" && location === "/dashboard");
            
            return (
              <li key={item.href}>
                <Link href={item.href}>
                  <div className={cn(
                    "flex items-center space-x-3 p-2 rounded-lg font-medium transition-colors cursor-pointer",
                    isActive 
                      ? "text-fhir-blue bg-blue-50" 
                      : "text-gray-700 hover:bg-gray-100"
                  )}>
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Resource Types Quick Access */}
        <div className="mt-8">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Quick Access
          </h3>
          <ul className="space-y-1">
            {quickAccessItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>
                  <div className="flex items-center justify-between p-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer">
                    <span>{item.label}</span>
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                      {resourceCounts?.[item.resourceType] || 0}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  );
}
