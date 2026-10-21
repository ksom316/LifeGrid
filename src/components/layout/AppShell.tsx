import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { SearchPalette } from '../search/SearchPalette'
import { isSearchShortcut, isTypingTarget } from '../../utils/keyboard'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const lastFocusedRef = useRef<HTMLElement | null>(null)

  const openSearch = () => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null
    setSearchOpen(true)
  }

  const closeSearch = () => {
    setSearchOpen(false)
    lastFocusedRef.current?.focus()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSearchShortcut(e)) return
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      openSearch()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setSidebarOpen(true)} onOpenSearch={openSearch} />
        <main className="flex-1 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:pb-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
      <MobileNav />
      <SearchPalette isOpen={searchOpen} onClose={closeSearch} />
    </div>
  )
}
