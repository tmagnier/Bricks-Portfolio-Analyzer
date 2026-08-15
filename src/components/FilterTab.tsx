import React from 'react';
import { cn } from '../lib/utils';

export function FilterTab({ 
  children, 
  active, 
  onClick,
  id
}: { 
  children: React.ReactNode; 
  active: boolean; 
  onClick: () => void;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer select-none",
        active ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
      )}
    >
      {children}
    </button>
  );
}
