import { useState } from 'react'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronRight, HomeIcon, Building2, Settings, Menu } from "lucide-react"
import { Link, useLocation } from 'react-router-dom'

interface SidebarProps {
  children: React.ReactNode
}

const Sidebar = ({ children }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const navigationItems = [
    {
      title: "Dashboard",
      icon: <HomeIcon />,
      href: "/dashboard"
    },
    {
      title: "Immobilien",
      icon: <Building2 />,
      href: "/properties"
    },
    {
      title: "Einstellungen",
      icon: <Settings />,
      href: "/settings"
    }
  ]

  return (
    <div className="flex min-h-screen">
      <div
        className={cn(
          "h-screen fixed top-0 left-0 bg-gray-900 text-white flex flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          {!collapsed && <span className="text-xl font-bold">Manager 06</span>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="hover:bg-gray-800"
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center space-x-2 p-2 rounded-lg transition-colors",
                    "hover:bg-gray-800",
                    location.pathname === item.href ? "bg-gray-800" : "",
                    collapsed ? "justify-center" : ""
                  )}
                >
                  {item.icon}
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <main 
        className={cn(
          "flex-1 transition-all duration-300",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

export default Sidebar