import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { SearchPalette } from '../search/SearchPalette'
import { isSearchShortcut, isTypingTarget } from '../../utils/keyboard'
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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onOpenSearch={openSearch} />
      <div className="app-glow flex min-h-screen flex-1 flex-col">
        <TopBar onMenuClick={() => setSidebarOpen(true)} onOpenSearch={openSearch} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      <SearchPalette isOpen={searchOpen} onClose={closeSearch} />
    </div>
  )
}
