"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Moon, Sun, Star } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { AuthButton } from "@/components/auth/AuthButton";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Prevent hydration mismatch by showing nothing until mounted
  if (!mounted) {
    return (
      <nav className="sticky top-0 z-50 w-full border-b border-transparent bg-transparent">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-6 w-6" /> {/* Placeholder for icon */}
              <span className="text-lg font-bold tracking-tight md:text-xl">
                Destiny Engine
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-10 w-10" /> {/* Placeholder for theme button */}
            <div className="h-10 w-32" /> {/* Placeholder for auth button */}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
        scrolled
          ? "border-border bg-background/95 backdrop-blur-md"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-500" />
            <span className="text-lg font-bold tracking-tight md:text-xl">
              Destiny Engine
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <AuthButton />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-[1.2rem] w-[1.2rem]" />
            ) : (
              <Moon className="h-[1.2rem] w-[1.2rem]" />
            )}
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;