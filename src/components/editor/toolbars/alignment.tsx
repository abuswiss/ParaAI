"use client"

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip"
import { useToolbar } from "./toolbar-provider"
import { cn } from "@/lib/utils"

const alignmentOptions = [
  { name: "Left", icon: AlignLeft, value: "left" },
  { name: "Center", icon: AlignCenter, value: "center" },
  { name: "Right", icon: AlignRight, value: "right" },
]

export function AlignmentTooolbar() {
  const { editor } = useToolbar()

  const handleAlignmentChange = (value: string) => {
    if (value) {
      editor.chain().focus().setTextAlign(value).run()
    } else {
      editor.chain().focus().setTextAlign("left").run()
    }
  }

  const currentAlignment = alignmentOptions.find((option) =>
    editor.isActive({ textAlign: option.value })
  )?.value

  return (
    <TooltipProvider>
        <ToggleGroup 
            type="single" 
            size="sm" 
            value={currentAlignment}
            onValueChange={handleAlignmentChange}
            aria-label="Text alignment"
        >
            {alignmentOptions.map((option) => (
                <Tooltip key={option.value}>
                    <TooltipTrigger asChild>
                        <ToggleGroupItem 
                            value={option.value} 
                            aria-label={`${option.name} align`}
                            className="h-8 w-8 px-1.5 data-[state=on]:bg-accent"
                        >
                            <option.icon className="h-4 w-4" />
                        </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{option.name}</p>
                    </TooltipContent>
                </Tooltip>
            ))}
        </ToggleGroup>
    </TooltipProvider>
  )
}
