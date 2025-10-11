import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
}

export default function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconColor = 'bg-blue-500'
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mb-2">{value}</p>
          {change && (
            <p className={`text-sm font-medium ${
              changeType === 'positive' ? 'text-green-600' :
              changeType === 'negative' ? 'text-red-600' :
              'text-slate-600'
            }`}>
              {change}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 ${iconColor} rounded-lg flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}
