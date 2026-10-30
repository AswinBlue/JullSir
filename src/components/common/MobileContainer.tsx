import React from 'react';

interface MobileContainerProps {
  children: React.ReactNode;
  theme?: 'light' | 'dark';
}

export const MobileContainer: React.FC<MobileContainerProps> = ({ 
  children, 
  theme = 'light' 
}) => {
  return (
    <div className={`min-h-screen w-full flex justify-center ${
      theme === 'dark' ? 'bg-slate-950' : 'bg-slate-200/70'
    }`}>
      {/* Centered Mobile Phone Frame */}
      <div className={`w-full max-w-md min-h-screen flex flex-col relative shadow-2xl transition-all ${
        theme === 'dark' 
          ? 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white border-x border-slate-800' 
          : 'bg-slate-50 text-slate-900 border-x border-slate-200'
      }`}>
        {children}
      </div>
    </div>
  );
};
