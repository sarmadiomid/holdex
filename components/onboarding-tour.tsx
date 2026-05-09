'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft, Sparkles, Wallet, PieChart, Coins, Store, Trophy } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface TourStep {
  id: string
  targetSelector: string
  title: string
  description: string
  icon: React.ReactNode
  position: 'top' | 'bottom' | 'left' | 'right'
  highlightNav?: 'dashboard' | 'allocate' | 'earn' | 'store' | 'leaderboard'
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    targetSelector: '[data-tour="header"]',
    title: 'Welcome to Holdex!',
    description: 'An investment tournament simulator where you compete for real TON prizes. Allocate your portfolio across crypto, gold, and forex.',
    icon: <Sparkles className="size-5" />,
    position: 'bottom'
  },
  {
    id: 'portfolio',
    targetSelector: '[data-tour="portfolio"]',
    title: 'Your Portfolio Value',
    description: 'Track your total HLX balance here. Allocations grow or shrink based on real market prices.',
    icon: <Wallet className="size-5" />,
    position: 'bottom'
  },
  {
    id: 'allocate',
    targetSelector: '[data-tour="nav-allocate"]',
    title: 'Allocate Your Portfolio',
    description: 'Distribute your HLX across Bitcoin, Gold, and EUR/USD. Your gains are amplified by leverage!',
    icon: <PieChart className="size-5" />,
    position: 'top',
    highlightNav: 'allocate'
  },
  {
    id: 'earn',
    targetSelector: '[data-tour="nav-earn"]',
    title: 'Earn Free HLX',
    description: 'Complete social tasks to earn extra HLX. Follow, share, and invite friends to boost your balance.',
    icon: <Coins className="size-5" />,
    position: 'top',
    highlightNav: 'earn'
  },
  {
    id: 'store',
    targetSelector: '[data-tour="nav-store"]',
    title: 'Upgrade Your Power',
    description: 'Buy leverage boosters in the Store to multiply your gains (and losses). Use Telegram Stars!',
    icon: <Store className="size-5" />,
    position: 'top',
    highlightNav: 'store'
  },
  {
    id: 'leaderboard',
    targetSelector: '[data-tour="nav-leaderboard"]',
    title: 'Weekly Rankings',
    description: 'Compete against other traders. Top performers win real TON prizes! Check your rank here.',
    icon: <Trophy className="size-5" />,
    position: 'top',
    highlightNav: 'leaderboard'
  }
]

function getElementPosition(selector: string): { top: number; left: number; width: number; height: number } | null {
  const element = document.querySelector(selector)
  if (!element) return null

  const rect = element.getBoundingClientRect()
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height
  }
}

export function OnboardingTour() {
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [visible, setVisible] = useState(false)
  const isTourCompleted = useAppStore((state) => state.isTourCompleted)
  const setTourCompleted = useAppStore((state) => state.setTourCompleted)
  const isAuthenticated = useAppStore((state) => state.isAuthenticated)

  useEffect(() => {
    if (!isTourCompleted && isAuthenticated) {
      const timer = setTimeout(() => {
        setVisible(true)
        const highlightNav = TOUR_STEPS[currentStep]?.highlightNav
        window.dispatchEvent(new CustomEvent('tourHighlight', { detail: { tab: highlightNav || null } }))
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [isTourCompleted, isAuthenticated])

  useEffect(() => {
    if (visible) {
      const updatePosition = () => {
        const rect = getElementPosition(TOUR_STEPS[currentStep]?.targetSelector || '')
        setTargetRect(rect)
      }

      updatePosition()
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)

      const interval = setInterval(updatePosition, 100)

      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
        clearInterval(interval)
      }
    }
  }, [visible, currentStep])

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      const nextStep = currentStep + 1
      setCurrentStep(nextStep)
      const highlightNav = TOUR_STEPS[nextStep]?.highlightNav
      window.dispatchEvent(new CustomEvent('tourHighlight', { detail: { tab: highlightNav || null } }))
    } else {
      setVisible(false)
      setTourCompleted()
      window.dispatchEvent(new CustomEvent('tourHighlight', { detail: { tab: null } }))
      setActiveTab('dashboard')
    }
  }, [currentStep, setTourCompleted])

  const handleSkip = useCallback(() => {
    setVisible(false)
    setTourCompleted()
    window.dispatchEvent(new CustomEvent('tourHighlight', { detail: { tab: null } }))
    setActiveTab('dashboard')
  }, [setTourCompleted])

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1
      setCurrentStep(prevStep)
      const highlightNav = TOUR_STEPS[prevStep]?.highlightNav
      window.dispatchEvent(new CustomEvent('tourHighlight', { detail: { tab: highlightNav || null } }))
    }
  }, [currentStep])

  const step = TOUR_STEPS[currentStep]

  const getTooltipPosition = () => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

    const tooltipWidth = 300
    const tooltipHeight = 200
    const margin = 16

    let top: string
    let left: string
    let transform = ''

    switch (step.position) {
      case 'top':
        top = `${targetRect.top - tooltipHeight - margin}px`
        left = `${targetRect.left + targetRect.width / 2 - tooltipWidth / 2}px`
        break
      case 'bottom':
        top = `${targetRect.top + targetRect.height + margin}px`
        left = `${targetRect.left + targetRect.width / 2 - tooltipWidth / 2}px`
        transform = 'translateY(-100%)'
        break
      case 'left':
        top = `${targetRect.top + targetRect.height / 2 - tooltipHeight / 2}px`
        left = `${targetRect.left - tooltipWidth - margin}px`
        break
      case 'right':
        top = `${targetRect.top + targetRect.height / 2 - tooltipHeight / 2}px`
        left = `${targetRect.left + targetRect.width + margin}px`
        break
      default:
        top = '50%'
        left = '50%'
        transform = 'translate(-50%, -50%)'
    }

    if (window.innerWidth < 500) {
      return {
        top: 'auto',
        bottom: '80px',
        left: '16px',
        right: '16px',
        transform: 'none'
      }
    }

    return { top, left, transform }
  }

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] pointer-events-none"
      >
        <div className="fixed inset-0 bg-black/70 pointer-events-auto" />

        {targetRect && (
          <>
            <div
              className="absolute border-2 border-neon-cyan rounded-xl pointer-events-none"
              style={{
                top: targetRect.top - 4,
                left: targetRect.left - 4,
                width: targetRect.width + 8,
                height: targetRect.height + 8,
                boxShadow: '0 0 20px rgba(0,255,255,0.5), inset 0 0 20px rgba(0,255,255,0.1)'
              }}
            />

            <div
              className="absolute bg-black/80 backdrop-blur-sm"
              style={{
                top: 0,
                left: 0,
                width: targetRect.left,
                height: targetRect.top
              }}
            />
            <div
              className="absolute bg-black/80 backdrop-blur-sm"
              style={{
                top: 0,
                left: targetRect.left + targetRect.width + 4,
                width: window.innerWidth - targetRect.left - targetRect.width - 4,
                height: targetRect.top
              }}
            />
            <div
              className="absolute bg-black/80 backdrop-blur-sm"
              style={{
                top: targetRect.top + targetRect.height + 4,
                left: 0,
                width: targetRect.left,
                height: window.innerHeight - targetRect.top - targetRect.height - 4
              }}
            />
            <div
              className="absolute bg-black/80 backdrop-blur-sm"
              style={{
                top: targetRect.top + targetRect.height + 4,
                left: targetRect.left + targetRect.width + 4,
                width: window.innerWidth - targetRect.left - targetRect.width - 4,
                height: window.innerHeight - targetRect.top - targetRect.height - 4
              }}
            />
          </>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="absolute p-4 glass rounded-2xl border border-neon-cyan/40 shadow-lg shadow-neon-cyan/20 pointer-events-auto w-[calc(100vw-32px)] max-w-[320px]"
          style={{
            ...getTooltipPosition(),
            transition: 'all 0.3s ease'
          }}
        >
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 size-6 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="size-3.5 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-xl bg-neon-cyan/20 border border-neon-cyan/40 flex items-center justify-center text-neon-cyan">
              {step.icon}
            </div>
            <div>
              <p className="text-[10px] text-neon-cyan uppercase tracking-wider">Step {currentStep + 1} of {TOUR_STEPS.length}</p>
              <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            {step.description}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === currentStep ? 'w-4 bg-neon-cyan' : 'w-1.5 bg-muted'
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="size-9 rounded-lg bg-muted/30 flex items-center justify-center hover:bg-muted/50 transition-colors"
                >
                  <ChevronLeft className="size-4 text-muted-foreground" />
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan text-background font-medium text-sm hover:bg-neon-cyan/90 transition-colors"
              >
                {currentStep < TOUR_STEPS.length - 1 ? (
                  <>
                    Next
                    <ChevronRight className="size-4" />
                  </>
                ) : (
                  <>
                    Finish
                    <Sparkles className="size-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}