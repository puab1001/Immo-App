// src/components/providers.tsx
import * as React from "react"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@radix-ui/react-tooltip"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </>
  )
}