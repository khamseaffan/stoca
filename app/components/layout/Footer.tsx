import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-secondary-200">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
        <p className="text-sm text-secondary-500">
          &copy; {new Date().getFullYear()} Stoca. All rights reserved.
        </p>
        <nav className="flex items-center gap-6">
          <Link
            href="/about"
            className="text-sm text-secondary-500 transition-colors hover:text-secondary-700"
          >
            About
          </Link>
          <Link
            href="/contact"
            className="text-sm text-secondary-500 transition-colors hover:text-secondary-700"
          >
            Contact
          </Link>
          <Link
            href="/terms"
            className="text-sm text-secondary-500 transition-colors hover:text-secondary-700"
          >
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  )
}
