import React from 'react';

export function DetailItem({ 
  label, 
  value,
  id
}: { 
  label: string; 
  value: React.ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="flex flex-col">
      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</span>
      <span className="text-sm font-semibold text-slate-700 capitalize">{value}</span>
    </div>
  );
}
