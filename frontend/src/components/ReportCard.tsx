import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ReportCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function ReportCard({ icon, iconBg, title, description, children }: ReportCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`${iconBg} rounded-lg p-3 text-white`}>
            {icon}
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}