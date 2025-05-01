"use client"

import React, { useMemo } from "react"
import {
  Check,
  ChevronDown,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Text,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu"
import { Button } from "@/components/ui/Button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useToolbar } from "./toolbar-provider"
import { useMediaQuery } from "@/hooks/use-media-query"
import { MobileToolbarGroup, MobileToolbarItem } from "./mobile-toolbar-group"
import { cn } from "@/lib/utils"

interface HeadingItem {
  name: string
  icon: React.ComponentType<{ className?: string }>
  level: 1 | 2 | 3 | 4 | 5 | 6
}

const headings: HeadingItem[] = [
  {
    name: "Heading 1",
    icon: Heading1,
    level: 1,
  },
  {
    name: "Heading 2",
    icon: Heading2,
    level: 2,
  },
  {
    name: "Heading 3",
    icon: Heading3,
    level: 3,
  },
  {
    name: "Heading 4",
    icon: Heading4,
    level: 4,
  },
  {
    name: "Heading 5",
    icon: Heading5,
    level: 5,
  },
  {
    name: "Heading 6",
    icon: Heading6,
    level: 6,
  },
]

export const HeadingsToolbar = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    const { editor } = useToolbar()
    const isMobile = useMediaQuery("(max-width: 640px)")
    const activeItem = useMemo(() => {
      for (const heading of headings) {
        if (editor?.isActive("heading", { level: heading.level })) {
          return heading
        }
      }
      return null
    }, [editor?.state.selection])

    const handleHeading = (level: number) => {
      editor?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run()
    }

    const handleParagraph = () => {
      editor?.chain().focus().setParagraph().run()
    }

    const ActiveIcon = activeItem?.icon ?? Text;

    if (isMobile) {
      return (
        <MobileToolbarGroup label={activeItem ? activeItem.name : "Paragraph"}>
          <MobileToolbarItem
            onClick={handleParagraph}
            active={!activeItem}
          >
            <Text className="h-4 w-4 mr-2" />
            Paragraph
          </MobileToolbarItem>
          {headings.map((heading) => (
            <MobileToolbarItem
              key={heading.level}
              onClick={() => handleHeading(heading.level)}
              active={activeItem?.level === heading.level}
            >
              <heading.icon className="h-4 w-4 mr-2" />
              {heading.name}
            </MobileToolbarItem>
          ))}
        </MobileToolbarGroup>
      )
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-max gap-1 px-3 font-normal",
                  editor?.isActive("heading") && "bg-accent",
                  className,
                )}
                ref={ref}
                {...props}
              >
                <ActiveIcon className="h-4 w-4 mr-1" />
                <span>{activeItem ? activeItem.name : "Paragraph"}</span>
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={handleParagraph}
                className={cn(!activeItem && "bg-accent")}
              >
                <Text className="h-4 w-4 mr-2" />
                Paragraph
                {!activeItem && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              {headings.map((heading) => (
                <DropdownMenuItem
                  key={heading.level}
                  onClick={() => handleHeading(heading.level)}
                  className={cn(activeItem?.level === heading.level && "bg-accent")}
                >
                  <heading.icon className="h-4 w-4 mr-2" />
                  {heading.name}
                  {activeItem?.level === heading.level && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent>
          <span>Headings</span>
        </TooltipContent>
      </Tooltip>
    )
  },
)

HeadingsToolbar.displayName = "HeadingsToolbar"
