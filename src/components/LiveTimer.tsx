import React, { useState, useEffect } from 'react'

export const LiveTimer: React.FC<{
  inicioIso?: string
  fimIso?: string
  status?: string
}> = ({ inicioIso, fimIso, status }) => {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (!inicioIso) {
      setElapsed('--:--')
      return
    }

    const calcTime = () => {
      const start = new Date(inicioIso).getTime()
      const end = fimIso ? new Date(fimIso).getTime() : Date.now()
      const diffMs = Math.max(0, end - start)

      const totalSecs = Math.floor(diffMs / 1000)
      const hours = Math.floor(totalSecs / 3600)
      const minutes = Math.floor((totalSecs % 3600) / 60)
      const seconds = totalSecs % 60

      if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
          2,
          '0',
        )}:${String(seconds).padStart(2, '0')}`
      }
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }

    setElapsed(calcTime())

    // Se estiver ativo, atualizar a cada segundo
    if (status === 'Ativo' && !fimIso) {
      const interval = setInterval(() => {
        setElapsed(calcTime())
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [inicioIso, fimIso, status])

  return (
    <span className="font-mono text-xs font-semibold tracking-wider text-[#030507]">{elapsed}</span>
  )
}
