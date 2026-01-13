import React from 'react';
import { X } from 'lucide-react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 ${className}`} {...props}>
    {children}
  </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'success' | 'neutral'; size?: 'sm' | 'md' | 'lg' }> = ({ children, className = '', variant = 'primary', size = 'md', ...props }) => {
  let baseClass = "rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ";
  
  if (size === 'sm') baseClass += "px-3 py-1 text-xs ";
  else if (size === 'lg') baseClass += "px-6 py-3 text-lg ";
  else baseClass += "px-4 py-2 ";

  if (variant === 'primary') baseClass += "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20";
  if (variant === 'danger') baseClass += "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20";
  if (variant === 'success') baseClass += "bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/20";
  if (variant === 'neutral') baseClass += "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm";

  return (
    <button className={`${baseClass} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input 
    ref={ref}
    className={`w-full rounded-lg px-4 py-2.5 text-base placeholder-gray-400 bg-gray-50 border-2 border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all ${props.className || ''}`} 
    {...props} 
  />
));
Input.displayName = 'Input';

export const Badge: React.FC<{ children: React.ReactNode, color?: string }> = ({ children, color = 'bg-gray-100 text-gray-800' }) => (
  <span className={`${color} text-xs px-2 py-1 rounded-md font-bold`}>
    {children}
  </span>
);

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string }> = ({ isOpen, onClose, title, children, className = 'bg-white' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-2xl p-6 relative animate-in fade-in zoom-in duration-200 shadow-2xl border border-gray-200 ${className}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full text-gray-500 hover:bg-gray-100 transition-all hover:scale-110 active:scale-95"
            title="Close"
          >
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};