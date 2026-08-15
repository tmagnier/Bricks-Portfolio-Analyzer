import React from 'react';
import { cn } from '../lib/utils';

export function StatCard({ 
  title, 
  value, 
  icon, 
  description, 
  trend, 
  badge,
  id
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  description?: React.ReactNode;
  trend?: 'positive' | 'negative';
  badge?: string;
  id?: string;
}) {
  return (
    <div id={id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 bg-slate-50 rounded-lg">
            {icon}
          </div>
          {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              {badge}
            </span>
          )}
          {trend && !badge && (
            <div className={cn(
              "text-xs font-bold px-2 py-1 rounded-full",
              trend === 'positive' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            )}>
              {trend === 'positive' ? '↑' : '↓'}
            </div>
          )}
        </div>
        <div className="text-xl md:text-2xl font-bold text-slate-900 mb-1 tracking-tight">{value}</div>
        <div className="text-xs font-semibold text-slate-500 mb-1">{title}</div>
      </div>
      {description && <div className="text-[11px] text-slate-400 mt-1">{description}</div>}
    </div>
  );
}
