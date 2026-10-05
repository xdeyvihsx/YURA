"use client"

import * as React from "react"
import {
  BadgeCheck,
  Bell,
  Check,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

// Theme hook
function useTheme() {
  const [theme, setTheme] = React.useState<"light" | "dark" | "system">("system")

  React.useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | "system" | null
    if (stored) {
      setTheme(stored)
    }
  }, [])

  React.useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }

    localStorage.setItem("theme", theme)
  }, [theme])

  return { theme, setTheme }
}

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { theme, setTheme } = useTheme()
  useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover>
          <PopoverTrigger className="w-full">
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground w-full rounded-2xl"
            >
              <Avatar className="h-8 w-8 rounded-xl">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-xl">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent className="min-w-58 rounded-2xl shadow-2xl bg-overlay text-overlay-foreground p-2">
            <div className="flex items-center gap-3 px-3 py-2 text-left">
              <Avatar className="h-10 w-10 rounded-xl">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-xl">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left">
                <span className="truncate font-semibold text-sm">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex flex-col gap-1">
              <button className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-overlay rounded-xl transition-colors font-medium">
                <Sparkles className="size-4" />
                Premium
              </button>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex flex-col gap-1">
              <button className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-overlay rounded-xl transition-colors">
                <BadgeCheck className="size-4" />
                Cuenta
              </button>
              <button className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-overlay rounded-xl transition-colors">
                <CreditCard className="size-4" />
                Suscripción
              </button>
              <button className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-overlay rounded-xl transition-colors">
                <Bell className="size-4" />
                Notificaciones
              </button>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => setTheme("light")}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-xl transition-colors justify-between ${
                  theme === "light" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent text-sidebar-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Sun className="size-4" />
                  Claro
                </div>
                {theme === "light" && <Check className="size-4" />}
              </button>
              <button 
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-xl transition-colors justify-between ${
                  theme === "dark" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent text-sidebar-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Moon className="size-4" />
                  Oscuro
                </div>
                {theme === "dark" && <Check className="size-4" />}
              </button>
              <button 
                onClick={() => setTheme("system")}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-xl transition-colors justify-between ${
                  theme === "system" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent text-sidebar-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Sun className="size-4" />
                  Auto
                </div>
                {theme === "system" && <Check className="size-4" />}
              </button>
            </div>
            <div className="h-px bg-border my-2" />
            <button className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-overlay rounded-xl transition-colors text-destructive">
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
