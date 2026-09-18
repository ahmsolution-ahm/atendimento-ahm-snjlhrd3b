import React, { useEffect, useState } from 'react'

interface CountUpProps {
  end: number
  duration?: number
  suffix?: string
}

export const CountUp: React.FC<CountUpProps> = ({ end, duration = 1000, suffix = '' }) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTimestamp: number | null = null
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      // Easing ease-out quad
      const current = Math.floor(progress * (2 - progress) * end)
      setCount(current)
      if (progress < 1) {
        window.requestAnimationFrame(step)
      } else {
        setCount(end)
      }
    }
    window.requestAnimationFrame(step)
  }, [end, duration])

  return (
    <span>
      {count}
      {suffix}
    </span>
  )
}
