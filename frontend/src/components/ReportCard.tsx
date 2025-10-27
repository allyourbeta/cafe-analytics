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

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-gray-300 transition-all duration-200 cursor-pointer overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-4"
      >
        <div
          className={`${iconBg} w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0`}
        >
          {icon}
        </div>
        <div className="text-left flex-1">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 ml-auto transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-100">{children}</div>
      )}
    </div>
  );
}
