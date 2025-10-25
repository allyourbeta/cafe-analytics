import { useState } from 'react';

interface ReportCardProps {
  icon: string;
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
  children
}: ReportCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`${iconBg} rounded-lg p-3 text-2xl`}>
            {icon}
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <div className="text-gray-400">
          {isExpanded ? '▼' : '▶'}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
}