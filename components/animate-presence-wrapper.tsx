"use client"

import { AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

interface AnimatePresenceWrapperProps {
  children: ReactNode
}

export default function AnimatePresenceWrapper({ children }: AnimatePresenceWrapperProps) {
  const pathname = usePathname()

  return <AnimatePresence mode="wait">{children}</AnimatePresence>
}
