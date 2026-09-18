import React from 'react'

interface LogoProps {
  className?: string
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
}

export const Logo: React.FC<LogoProps> = ({ className = '', variant = 'dark', size = 'md' }) => {
  const isLight = variant === 'light'

  const iconSizes = {
    sm: 'w-6 h-6 rounded-md text-xs',
    md: 'w-8 h-8 rounded-lg text-sm',
    lg: 'w-10 h-10 rounded-xl text-base',
  }

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  }

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Símbolo: quadrado estilizado com destaque vermelho coral */}
      <div
        className={`${iconSizes[size]} relative flex items-center justify-center font-black transition-transform duration-150 group-hover:scale-105 shadow-sm overflow-hidden`}
        style={{
          backgroundColor: isLight ? '#030507' : '#FAF7F2',
          border: '1.5px solid #DE6464',
        }}
      >
        <span className="font-extrabold tracking-tighter" style={{ color: '#DE6464' }}>
          A
        </span>
        <div
          className="absolute -bottom-1 -right-1 w-3 h-3 rotate-45"
          style={{ backgroundColor: '#DE6464' }}
        />
      </div>

      {/* Tipografia: AHM Solution em bold com 'A' em destaque */}
      <div className={`font-bold tracking-tight ${textSizes[size]}`}>
        <span style={{ color: '#DE6464' }}>A</span>
        <span style={{ color: isLight ? '#FFFFFF' : '#030507' }}>HM </span>
        <span className="font-semibold" style={{ color: isLight ? '#E5E7EB' : '#030507' }}>
          Solution
        </span>
      </div>
    </div>
  )
}
