"use client"

import type { Editor } from "@tiptap/react"
import React from "react"

export interface ToolbarContextProps {
  editor: Editor
}

const ToolbarContext = React.createContext<ToolbarContextProps | null>(null)

export const useToolbar = () => {
  const context = React.useContext(ToolbarContext)
  if (!context) {
    throw new Error("useToolbar must be used within a ToolbarProvider")
  }
  return context
}

export function ToolbarProvider({ editor, children }: { editor: Editor; children: React.ReactNode }) {
  return <ToolbarContext.Provider value={{ editor }}>{children}</ToolbarContext.Provider>
}
