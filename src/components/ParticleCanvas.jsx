import React, { useEffect, useRef } from 'react'

export default function ParticleCanvas() {
  const ref = useRef()

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let W, H, particles = [], raf

    const resize = () => {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    class P {
      reset() {
        this.x = Math.random() * W
        this.y = Math.random() * H
        this.r = Math.random() * 1.4 + 0.2
        this.vx = (Math.random() - 0.5) * 0.25
        this.vy = (Math.random() - 0.5) * 0.25
        this.life = Math.random()
        this.max = Math.random() * 0.7 + 0.3
        this.c = Math.random() > 0.55 ? '0,229,255' : '181,74,255'
      }
      constructor() { this.reset() }
      update() {
        this.x += this.vx; this.y += this.vy; this.life += 0.0018
        if (this.life > this.max || this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset()
      }
      draw() {
        const a = Math.sin((this.life / this.max) * Math.PI) * 0.55
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${this.c},${a})`
        ctx.fill()
      }
    }

    for (let i = 0; i < 100; i++) particles.push(new P())

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      particles.forEach(p => { p.update(); p.draw() })
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.45 }}
    />
  )
}
