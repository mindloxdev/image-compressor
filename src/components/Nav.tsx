import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { Logo, Wordmark } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const LINKS = [
  { to: '/image-compressor', label: 'Compressor' },
  { to: '/compress-jpg', label: 'JPG' },
  { to: '/compress-png', label: 'PNG' },
  { to: '/compress-webp', label: 'WebP' },
  { to: '/compress-images-for-websites', label: 'For websites' },
  { to: '/guides', label: 'Guides' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Navigating closes the panel; otherwise it would hang over the new page.
  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 text-ink no-underline"
          aria-label="Pixelpress home"
        >
          <Logo size={28} />
          <Wordmark className="text-[17px]" />
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-control px-3 py-2 text-sm font-medium no-underline transition-colors duration-150 ${
                  isActive
                    ? 'bg-brand-soft text-brand'
                    : 'text-muted hover:bg-sunken hover:text-ink'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <ThemeToggle />
          <Link to="/image-compressor" className="btn btn-primary hidden sm:inline-flex">
            Compress images
          </Link>
          <button
            ref={triggerRef}
            type="button"
            className="btn btn-ghost h-11 w-11 px-0 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        ref={panelRef}
        hidden={!open}
        className="border-t border-line bg-surface lg:hidden"
      >
        <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-col gap-1 p-3">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-control px-3 py-3 text-[15px] font-medium no-underline ${
                  isActive ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-sunken'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
