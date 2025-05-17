"use client";

import React, { useState, useEffect } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { MenuBar } from "@/components/ui/glow-menu";
import { Home, Sparkles, UserCircle } from "lucide-react";
import { motion } from "framer-motion";

// Create a motion-enhanced Link component
const MotionLink = motion(RouterLink);

interface AppHeaderMenuItem {
  icon: React.ElementType;
  label: string;
  href: string;
  gradient: string;
  iconColor: string;
}

const AppHeader = () => {
  const [activeItem, setActiveItem] = useState<string>("");
  const location = useLocation();

  const menuItems: AppHeaderMenuItem[] = [
    {
      icon: Home,
      label: "Home",
      href: "#",
      gradient:
        "radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.06) 50%, rgba(29,78,216,0) 100%)",
      iconColor: "text-blue-500",
    },
    {
      icon: Sparkles,
      label: "Legal AI",
      href: "/dashboard",
      gradient:
        "radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(147,51,234,0.06) 50%, rgba(126,34,206,0) 100%)",
      iconColor: "text-purple-500",
    },
  ];

  useEffect(() => {
    const currentPath = location.pathname;
    const activeMenuEntry = menuItems.find(item => item.href === currentPath);
    if (activeMenuEntry) {
      setActiveItem(activeMenuEntry.label);
    } else {
      // Optional: Clear active item if no route matches, or set a default
      // For now, if you navigate to a path not in menuItems, no item will be active.
      // setActiveItem(""); // Uncomment to clear if no match
    }
  }, [location.pathname]);

  const handleSetActiveItem = (label: string) => {
    // This can still be used if you want to allow manual active state setting,
    // but route-based activation will usually override it on navigation.
    setActiveItem(label);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 shadow-none py-1 px-3">
      <div className="container mx-auto flex items-center justify-between">
        <nav>
          <ul className="flex items-center gap-1">
            {menuItems.map((item) => (
              <li key={item.label} className="relative">
                <MotionLink
                  to={item.href}
                  onClick={() => handleSetActiveItem(item.label)}
                  className="block cursor-pointer"
                  aria-label={item.label}
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                >
                  <MenuBar
                    items={[{
                      ...item,
                      icon: item.icon as any,
                    }]}
                    activeItem={activeItem}
                    onItemClick={() => handleSetActiveItem(item.label)}
                  />
                </MotionLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="relative">
          <button 
            className="flex items-center gap-2 text-foreground hover:text-primary transition-colors p-2 rounded-full hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            aria-label="Account options"
          >
            <UserCircle className="h-8 w-8" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader; 