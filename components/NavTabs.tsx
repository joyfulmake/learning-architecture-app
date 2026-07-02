"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/architecture", label: "Architecture" },
  { href: "/challenges", label: "Challenges" },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <header className="border-b border-gray-200 bg-gradient-to-b from-white to-gray-50/60">
      <div className="mx-auto max-w-6xl px-6 py-5 flex items-center gap-10">
        <span className="text-xl font-extrabold tracking-tight">
          Learning <span className="text-green-600">Architecture</span>
        </span>
        <nav className="flex gap-2">
          {TABS.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 rounded-full text-base font-bold transition ${
                  active
                    ? "bg-green-100 text-green-800 shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
