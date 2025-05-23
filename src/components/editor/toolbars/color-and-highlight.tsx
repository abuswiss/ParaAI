"use client"
/* eslint-disable */
// @ts-nocheck
import React, { useState } from "react"
import { Palette, Highlighter } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToolbar } from "./toolbar-provider"
import { cn } from "@/lib/utils"

// Define colors and highlights based on theme or standard palette
const themeColors = [
  { name: "Default", color: "var(--foreground)", class: "bg-[var(--foreground)] dark:bg-[var(--dark-foreground)]" }, // Swatch shows the text color
  { name: "Muted", color: "var(--muted-foreground)", class: "bg-[var(--muted-foreground)] dark:bg-[var(--dark-muted-foreground)]" },
  { name: "Primary", color: "var(--primary)", class: "bg-[var(--primary)] dark:bg-[var(--dark-primary)]" },
  { name: "Red", color: "#ef4444", class: "bg-red-500 dark:bg-red-400" },
  { name: "Orange", color: "#f97316", class: "bg-orange-500 dark:bg-orange-400" },
  { name: "Yellow", color: "#eab308", class: "bg-yellow-500 dark:bg-yellow-400" },
  { name: "Green", color: "#22c55e", class: "bg-green-500 dark:bg-green-400" },
  { name: "Blue", color: "#3b82f6", class: "bg-blue-500 dark:bg-blue-400" },
  { name: "Purple", color: "#a855f7", class: "bg-purple-500 dark:bg-purple-400" },
  { name: "Pink", color: "#ec4899", class: "bg-pink-500 dark:bg-pink-400" },
]

const themeHighlights = [
  { name: "Default", color: "transparent", class: "bg-transparent border-dashed" }, // Add dashed border for visibility
  { name: "Muted", color: "var(--muted)", class: "bg-muted text-muted-foreground dark:bg-dark-muted dark:text-dark-muted-foreground" },
  { name: "Primary", color: "var(--primary-highlight)", class: "bg-primary/20 text-primary dark:bg-dark-primary/20 dark:text-dark-primary" }, // Assuming --primary-highlight is defined or use direct value
  { name: "Red", color: "#fee2e2", class: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
  { name: "Orange", color: "#ffedd5", class: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" },
  { name: "Yellow", color: "#fef9c3", class: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300" },
  { name: "Green", color: "#dcfce7", class: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" },
  { name: "Blue", color: "#dbeafe", class: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  { name: "Purple", color: "#f3e8ff", class: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" },
  { name: "Pink", color: "#fce7f3", class: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300" },
]

interface ColorButtonProps {
  // color prop is used for editor's internal state, not directly for styling button
  name: string
  isActive?: boolean
  onClick: () => void
  classNameFromTheme: string // Renamed from className to avoid conflict
}

const ColorButton: React.FC<ColorButtonProps> = ({ name, isActive, onClick, classNameFromTheme }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md border border-border transition-all",
            isActive && "ring-2 ring-ring ring-offset-2 ring-offset-background",
            classNameFromTheme // Apply the full class string from themeColors/themeHighlights
          )}
          aria-label={name}
        />
      </TooltipTrigger>
      <TooltipContent>
        <p>{name}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

export function ColorHighlightToolbar() {
  const { editor } = useToolbar()
  const [textColor, setTextColor] = useState("")
  const [highlightColor, setHighlightColor] = useState("")

  const handleTextColorChange = (color: string) => {
    if (color === "var(--foreground)") { // Check for default CSS variable
        editor.chain().focus().unsetColor().run()
    } else {
        editor.chain().focus().setColor(color).run()
    }
  }

  const handleHighlightChange = (color: string) => {
     if (color === "transparent") { // Check for default/transparent
        editor.chain().focus().unsetHighlight().run()
    } else {
        editor.chain().focus().setHighlight({ color }).run()
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost">
                 {/* Dynamically show current color/highlight? Maybe too complex */}
                 <Palette className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Text Color & Highlight</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-2">
        <Tabs defaultValue="color" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-8 mb-2">
            <TabsTrigger value="color" className="h-full text-xs">Color</TabsTrigger>
            <TabsTrigger value="highlight" className="h-full text-xs">Highlight</TabsTrigger>
          </TabsList>

          <TabsContent value="color">
             {/* Optional: Custom color input */}
            {/* <div className="mb-2 flex items-center gap-2">
              <Input 
                type="text" 
                className="h-8 flex-1" 
                placeholder="#000000" 
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
              />
              <Button size="sm" className="h-8 px-2" onClick={() => handleTextColorChange(textColor)}>Set</Button>
            </div> */}
            <div className="grid grid-cols-5 gap-1">
              {themeColors.map(({ name, color, class: colorClass }) => (
                <ColorButton
                  key={name}
                  name={name}
                  classNameFromTheme={colorClass} // Pass the Tailwind class for styling
                  isActive={editor.isActive("textStyle", { color }) || (color === 'var(--foreground)' && !editor.getAttributes('textStyle').color)}
                  onClick={() => handleTextColorChange(color)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="highlight">
             {/* Optional: Custom highlight input */}
            {/* <div className="mb-2 flex items-center gap-2">
               <Input 
                 type="text" 
                 className="h-8 flex-1" 
                 placeholder="#FFFF00" 
                 value={highlightColor}
                 onChange={(e) => setHighlightColor(e.target.value)}
              />
              <Button size="sm" className="h-8 px-2" onClick={() => handleHighlightChange(highlightColor)}>Set</Button>
            </div> */}
            <div className="grid grid-cols-5 gap-1">
              {themeHighlights.map(({ name, color, class: bgClass }) => (
                <ColorButton
                  key={name}
                  name={name}
                  classNameFromTheme={bgClass} // Pass the Tailwind class for styling
                  isActive={editor.isActive("highlight", { color }) || (color === 'transparent' && !editor.getAttributes('highlight').color)}
                  onClick={() => handleHighlightChange(color)}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
