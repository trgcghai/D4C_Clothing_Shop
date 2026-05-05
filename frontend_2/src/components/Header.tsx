import { Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { Search, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import ThemeToggle from './ThemeToggle'
import { useMeQuery, useSignOutMutation } from '@/features/auth/hooks'
import { isAdminRole, getAccessToken } from '@/features/auth/store'

const NAV_LINK_CLASS = cn(
  'inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-semibold text-gray-700 transition hover:text-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
)

const ICON_BUTTON_CLASS = cn(
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
)

const MOBILE_LINK_CLASS = 'block min-h-11 py-3 text-base text-gray-700 hover:text-purple-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-md'

function useSearchNavigation() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = useCallback(() => {
    const trimmed = searchQuery.trim()
    if (trimmed) {
      navigate({ to: '/all-products', search: { q: trimmed } })
      setSearchQuery('')
    }
  }, [searchQuery, navigate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }, [handleSearch])

  return { searchQuery, setSearchQuery, handleSearch, handleKeyDown }
}

function SearchField({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const { searchQuery, setSearchQuery, handleSearch, handleKeyDown } = useSearchNavigation()

  if (variant === 'mobile') {
    return (
      <div className="px-4 pt-3 pb-2 sm:hidden">
        <div className="relative">
          <label htmlFor="mobile-search" className="sr-only">Search products</label>
          <input
            id="mobile-search"
            type="search"
            placeholder="Search products..."
            autoComplete="off"
            className="w-full rounded-full border border-gray-300 pl-10 pr-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            aria-label="Search"
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-purple-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-md"
            onClick={handleSearch}
          >
            <Search size={18} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative hidden sm:block">
      <label htmlFor="desktop-search" className="sr-only">Search products</label>
      <input
        id="desktop-search"
        type="search"
        placeholder="Search products..."
        autoComplete="off"
        className="w-48 lg:w-56 rounded-full border border-gray-300 pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        aria-label="Search"
        className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-purple-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-md"
        onClick={handleSearch}
      >
        <Search size={18} />
      </button>
    </div>
  )
}

function AuthNavLinks({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void }) {
  const { data: me, isLoading: meLoading } = useMeQuery()
  const signOutMutation = useSignOutMutation()
  const navigate = useNavigate()

  const hasToken = getAccessToken() != null
  const isAuthed = !meLoading && hasToken && !!me
  const adminRole = isAdminRole(me?.role)

  const handleSignOut = useCallback(() => {
    signOutMutation.mutate(undefined, {
      onSuccess: () => {
        onClose?.()
        navigate({ to: '/signin' })
      },
    })
  }, [signOutMutation, navigate, onClose])

  const linkClass = mobile ? MOBILE_LINK_CLASS : NAV_LINK_CLASS
  const activeClass = mobile ? cn(MOBILE_LINK_CLASS, 'text-purple-600 font-bold') : cn(NAV_LINK_CLASS, 'text-purple-600')

  const handleLinkClick = useCallback(() => {
    onClose?.()
  }, [onClose])

  return (
    <>
      <Link to="/" className={linkClass} activeProps={{ className: activeClass }} onClick={handleLinkClick}>
        Products
      </Link>
      {adminRole && (
        <Link to="/admin" className={linkClass} activeProps={{ className: activeClass }} onClick={handleLinkClick}>
          Admin
        </Link>
      )}
      {isAuthed ? (
        <>
          <Link to="/profile" className={linkClass} activeProps={{ className: activeClass }} onClick={handleLinkClick}>
            Profile
          </Link>
          <button
            type="button"
            className={cn(linkClass, 'disabled:opacity-50 disabled:cursor-not-allowed')}
            onClick={handleSignOut}
            disabled={signOutMutation.isPending}
          >
            {signOutMutation.isPending ? 'Signing out...' : 'Sign out'}
          </button>
        </>
      ) : (
        <>
          <Link to="/signin" className={linkClass} activeProps={{ className: activeClass }} onClick={handleLinkClick}>
            Sign in
          </Link>
          <Link to="/signup" className={linkClass} activeProps={{ className: activeClass }} onClick={handleLinkClick}>
            Sign up
          </Link>
        </>
      )}
    </>
  )
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-lg shadow-md">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-x-3 gap-y-2">
        {/* Logo */}
        <Link
          to="/"
          aria-label="D4C Clothing Shop home"
          className="flex-shrink-0 text-xl sm:text-2xl font-semibold text-purple-600 tracking-wide hover:text-purple-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded-md"
        >
          D4CClothingShop
        </Link>

        {/* Desktop Nav */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1 ml-auto">
          <AuthNavLinks />
        </nav>

        {/* Search + Theme + Mobile Toggle */}
        <div className="flex items-center gap-2 ml-auto md:ml-2">
          <SearchField variant="desktop" />
          <ThemeToggle />

          {/* Mobile menu button */}
          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            className={ICON_BUTTON_CLASS}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div id="mobile-menu" className="md:hidden border-t bg-white shadow-md">
          <SearchField variant="mobile" />
          <nav aria-label="Mobile navigation" className="flex flex-col px-4 py-2">
            <AuthNavLinks mobile onClose={() => setMobileOpen(false)} />
          </nav>
        </div>
      )}
    </header>
  )
}
