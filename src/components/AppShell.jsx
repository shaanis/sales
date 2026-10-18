
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  CarFront,
  CalendarDays,
  ReceiptText,
  LogOut,
  Zap,
} from "lucide-react";

import { useAuth } from "../features/auth/AuthProvider";

export default function AppShell({ children }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const navigation = [
    { path: "/", label: "Overview", Icon: LayoutDashboard },
    { path: "/report", label: "Daily report", Icon: ClipboardList },
    { path: "/expenses", label: "Travel & expenses", Icon: CarFront },
    {
      path: "/expense-history",
      label: "Expense log",
      Icon: ReceiptText,
    },
    { path: "/history", label: "Report history", Icon: CalendarDays },
    
  ];

  async function logout() {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  const displayName = user?.displayName || "Sales executive";
  const email = user?.email || "";
  const avatar = (user?.displayName || user?.email || "S")
    .charAt(0)
    .toUpperCase();

  const linkClass = ({ isActive }) =>
    [
      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold",
      "transition-all duration-200",
      isActive
        ? "bg-[#21464b] text-white [&_svg]:text-[#51d8c6]"
        : "text-[#b6cbcd] hover:bg-[#193a40] hover:text-white",
    ].join(" ");

  return (
    <div className="min-h-screen bg-[#f4f7f8] text-[#19363e]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[#2b494e] bg-[#102b32] text-[#d7e6e7] lg:flex">
        {/* Brand */}
        <div className="flex shrink-0 items-center gap-3 border-b border-[#2b494e] px-5 py-6">
          <div className="flex h-[41px] w-[41px] shrink-0 items-center justify-center rounded-xl bg-[#12a594] font-['Manrope'] text-sm font-extrabold text-white">
            ES
          </div>

          <div className="min-w-0">
            <h1 className="font-['Manrope'] text-sm font-extrabold tracking-[1px] text-white">
              ECHONIX
            </h1>
            <p className="mt-1 text-[10px] text-[#8ea9ac]">
              Sales workspace
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-[10px] font-bold tracking-[1.5px] text-[#8ba7aa]">
            WORKSPACE
          </p>

          <nav className="grid gap-1">
            {navigation.map(({ path, label, Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                className={linkClass}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Sidebar note */}
          <div className="mt-auto pt-8">
            <div className="rounded-xl border border-[#2a4e53] bg-[#193a40] p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#21464b]">
                <Zap size={18} className="text-[#51d8c6]" />
              </div>

              <h2 className="text-sm font-bold text-white">
                Keep it moving
              </h2>

              <p className="mt-2 text-[10px] leading-[1.7] text-[#a4bec0]">
                Log field activity while it's fresh. Your report will be
                ready to share.
              </p>
            </div>
          </div>
        </div>

        {/* Profile and logout */}
        <div className="shrink-0 border-t border-[#2b494e] p-4">
          <button
            type="button"
            onClick={logout}
            className="group flex w-full items-center gap-2 rounded-lg border-t border-[#2b494e] px-1 py-4 text-left transition hover:bg-[#193a40]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d5f3ed] text-sm font-extrabold text-[#087d70]">
              {avatar}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-bold text-[#c7d9da]">
                {displayName}
              </span>
              <span className="mt-1 block truncate text-[9px] text-[#8fa9ac]">
                {email}
              </span>
            </span>

            <LogOut
              size={15}
              className="shrink-0 text-[#8fa9ac] transition group-hover:text-[#51d8c6]"
            />
          </button>
        </div>
      </aside>

      {/* Main workspace */}
      <div className="min-h-screen min-w-0 lg:pl-60">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 border-b border-[#e3eaec] bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[#12a594] font-['Manrope'] text-sm font-extrabold text-white">
              ES
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-['Manrope'] text-sm font-extrabold text-[#16353d]">
                ECHONIX Sales
              </p>
              <p className="truncate text-[10px] text-[#82949a]">
                {displayName}
              </p>
            </div>

            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#82949a] transition hover:bg-[#fff0ee] hover:text-red-600"
            >
              <LogOut size={17} />
            </button>
          </div>

          {/* Mobile navigation */}
          <nav className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {navigation.map(({ path, label, Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                className={({ isActive }) =>
                  [
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-[11px] font-semibold transition",
                    isActive
                      ? "bg-[#21464b] text-white [&_svg]:text-[#51d8c6]"
                      : "bg-[#f4f7f8] text-[#49636a] hover:bg-[#e7eeee]",
                  ].join(" ")
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        {/* Page content */}
        <main className="mx-auto min-h-[calc(100vh-65px)] w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="mt-auto flex flex-col gap-1 border-t border-[#e3eaec] bg-white px-5 py-4 text-[9px] text-[#93a3a6] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>ECHONIX · Sales workspace</span>
          <span>Cloud data · Firebase</span>
        </footer>
      </div>
    </div>
  );
}
