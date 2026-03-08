import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Film,
  ListTodo,
  Settings,
  Flame
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clips', icon: Film, label: 'Clips' },
  { to: '/queue', icon: ListTodo, label: 'Queue' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <aside className={cn(
      'w-64 bg-dark-900 border-r border-dark-800 flex flex-col',
      'fixed md:static inset-y-0 left-0 z-50',
      'transition-transform duration-300 ease-in-out',
      isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    )}>
      {/* Logo */}
      <div className="p-6 border-b border-dark-800">
        <NavLink to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-forge-400 to-forge-600 flex items-center justify-center">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold">ClipForge</span>
        </NavLink>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-forge-500/10 text-forge-400'
                      : 'text-dark-400 hover:text-white hover:bg-dark-800'
                  )
                }
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
