import React, { useEffect, useRef } from 'react'
import { scoreColor } from '../utils/format'

export default function ScoreRing({ score, size = 140, strokeWidth = 8 }) {
  const circleRef = useRef()
  const r = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * r
  const color = scoreColor(score)

  useEffect(() => {
    if (circleRef.current) {
      const offset = circumference - (score / 100) * circumference
      circleRef.current.style.strokeDashoffset = offset
    }
  }, [score, circumference])

  return (
    <div className="score-ring-wrap" style={{ width: size, height: size }}>
      <svg
        className="score-ring"
        width={size} height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="score-ring-bg"
          cx={size / 2} cy={size / 2} r={r}
          strokeWidth={strokeWidth}
        />
        <circle
          ref={circleRef}
          className="score-ring-fill"
          cx={size / 2} cy={size / 2} r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
        />
      </svg>
      <div className="score-center">
        <div className="score-num" style={{ color }}>{score}</div>
        <div className="score-den">/ 100</div>
      </div>
    </div>
  )
}
