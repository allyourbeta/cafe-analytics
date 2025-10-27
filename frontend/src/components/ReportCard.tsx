import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface ReportCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function ReportCard({
  icon,
  iconBg,
  title,
  description,
  children,
}: ReportCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine gradient background based on icon color
  const getGradientBg = (bgClass: string) => {
    if (bgClass.includes("orange")) {
      return "bg-gradient-to-br from-orange-400 to-amber-600";
    } else if (bgClass.includes("blue")) {
      return "bg-gradient-to-br from-blue-400 to-blue-600";
    } else if (bgClass.includes("green")) {
      return "bg-gradient-to-br from-green-400 to-green-600";
    } else if (bgClass.includes("purple")) {
      return "bg-gradient-to-br from-purple-400 to-purple-600";
    } else if (bgClass.includes("pink")) {
      return "bg-gradient-to-br from-pink-400 to-pink-600";
    } else if (bgClass.includes("teal")) {
      return "bg-gradient-to-br from-teal-400 to-cyan-600";
    }
    return bgClass;
  };

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div
            className={`${getGradientBg(
              iconBg
            )} rounded-lg p-3.5 text-white shadow-lg`}
          >
            {icon}
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {isExpanded && <div className="border-t border-gray-100">{children}</div>}
    </div>
  );
}
