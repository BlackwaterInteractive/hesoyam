'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

interface AnimateInProps {
  children: React.ReactNode
  className?: string
  delay?: number
  duration?: number
  from?: 'bottom' | 'left' | 'right' | 'fade'
  once?: boolean
}

const variants = {
  bottom: { hidden: { opacity: 0, y: 28 },   visible: { opacity: 1, y: 0 } },
  left:   { hidden: { opacity: 0, x: -28 },  visible: { opacity: 1, x: 0 } },
  right:  { hidden: { opacity: 0, x: 28 },   visible: { opacity: 1, x: 0 } },
  fade:   { hidden: { opacity: 0 },           visible: { opacity: 1 } },
}

export function AnimateIn({
  children,
  className,
  delay = 0,
  duration = 0.65,
  from = 'bottom',
  once = true,
}: AnimateInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once, margin: '0px 0px -60px 0px' })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={variants[from]}
      transition={{
        duration,
        delay: delay / 1000,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  )
}

interface StaggerProps {
  children: React.ReactNode
  className?: string
  staggerDelay?: number
  delay?: number
}

export function StaggerChildren({ children, className, staggerDelay = 100, delay = 0 }: StaggerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: {
          transition: {
            delayChildren: delay / 1000,
            staggerChildren: staggerDelay / 1000,
          },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
  from = 'bottom',
}: {
  children: React.ReactNode
  className?: string
  from?: 'bottom' | 'fade'
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: from === 'bottom' ? { opacity: 0, y: 24 } : { opacity: 0 },
        visible: { opacity: 1, y: 0, x: 0 },
      }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
