import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth0 } from "@auth0/auth0-react";
import { Brain, LogOut, Menu, X } from "lucide-react";

const navItems = [
  { label: "Auth API Test", href: "#auth-api-test" },
  { label: "Dashboard", href: "#dashboard" },
  { label: "Services", href: "#services" },
  { label: "Doctors", href: "#doctors" },
  { label: "Book Appointment", href: "#book-appointment" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isLoading, isAuthenticated, user, loginWithRedirect, logout } = useAuth0();

  const handleLogin = () => loginWithRedirect();
  const handleSignup = () =>
    loginWithRedirect({ authorizationParams: { screen_hint: "signup" } });
  const handleLogout = () =>
    logout({ logoutParams: { returnTo: window.location.origin } });

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a
          href="#home"
          className="inline-flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-foreground transition-colors hover:text-primary"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
            <Brain className="h-4 w-4" />
          </span>
          MNEMOSYNE CARE
        </a>

        <div className="hidden items-center md:flex">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-body text-foreground/85 transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          {!isAuthenticated ? (
            <div className="ml-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleLogin}
                disabled={isLoading}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={handleSignup}
                disabled={isLoading}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sign Up
              </button>
            </div>
          ) : (
            <div className="ml-4 flex items-center gap-2">
              <span className="max-w-44 truncate rounded-md border border-border/70 bg-card/70 px-3 py-2 text-xs text-muted-foreground">
                {user?.email || user?.name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          aria-expanded={isOpen}
          aria-label="Toggle navigation menu"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground md:hidden"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </nav>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-border/50 bg-card md:hidden"
        >
          <ul className="space-y-1 px-4 py-3">
            {navItems.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-body text-foreground/90 transition-colors hover:bg-secondary"
                >
                  {item.label}
                </a>
              </li>
            ))}

            {!isAuthenticated ? (
              <li className="pt-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      handleLogin();
                    }}
                    disabled={isLoading}
                    className="flex-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      handleSignup();
                    }}
                    disabled={isLoading}
                    className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Sign Up
                  </button>
                </div>
              </li>
            ) : (
              <li className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </li>
            )}
          </ul>
        </motion.div>
      )}
    </header>
  );
};

export default Navbar;
