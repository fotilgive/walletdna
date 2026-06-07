import React, { useEffect, useRef } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer
} from 'recharts'
import { dnaLabels, dnaColors } from '../utils/format'

const CustomTick = ({ x, y, payload }) => (
  <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
    fill="var(--text-2)" fontSize={10} fontFamily="Outfit">
    {payload.value}
  </text>
)

export default function DNARadar({ scores }) {
  if (!scores) return null

  const data = Object.keys(scores)
    .filter(key => scores[key] !== null && scores[key] !== undefined)
    .map(key => ({
      metric: dnaLabels[key] || key,
      value: scores[key],
      fullMark: 100,
      key,
    }))

  return (
    <div className="dna-chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid
            stroke="rgba(255,255,255,0.06)"
            gridType="polygon"
          />
          <PolarAngleAxis dataKey="metric" tick={<CustomTick />} />
          <Radar
            name="DNA"
            dataKey="value"
            stroke="var(--cyan)"
            fill="var(--cyan)"
            fillOpacity={0.12}
            strokeWidth={2}
            dot={{ fill: 'var(--cyan)', r: 3, strokeWidth: 0 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DNAMetricList({ scores }) {
  if (!scores) return null
  return (
    <div>
      {Object.entries(scores)
        .filter(([, val]) => val !== null && val !== undefined)
        .map(([key, val]) => (
          <div className="metric-row" key={key}>
            <div className="metric-name">{dnaLabels[key] || key}</div>
            <div className="metric-bar-track">
              <div
                className="metric-bar-fill"
                style={{
                  width: `${val}%`,
                  background: dnaColors[key] || 'var(--cyan)',
                  boxShadow: `0 0 8px ${dnaColors[key] || 'var(--cyan)'}40`,
                }}
              />
            </div>
            <div className="metric-val" style={{ color: dnaColors[key] || 'var(--cyan)' }}>
              {val}
            </div>
          </div>
        ))}
    </div>
  )
}
