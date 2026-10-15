import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  CarFront,
  CalendarDays,
  LogOut,
} from "lucide-react";

import { useAuth } from "../features/auth/AuthProvider";

export default function AppShell({ children }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const navigation = [
    ["/", "Overview", LayoutDashboard],
    ["/report", "Daily report", ClipboardList],
    ["/expenses", "Travel & expenses", CarFront],
    ["/history", "Report history", CalendarDays],
  ];

  async function logout() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">ES</div>
          <div>
            <strong>ECHONIX</strong>
            <small>Sales workspace</small>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          {navigation.map(([path, label, Icon]) => (
            <NavLink
              end={path === "/"}
              to={path}
              key={path}
              className={({ isActive }) =>
                "nav-item" + (isActive ? " active" : "")
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="side-bottom">
          <div className="side-note">
            <strong>Keep it moving</strong>
            <p>
              Log field activity while it's fresh. Your report will be
              ready to share.
            </p>
          </div>

          <button className="profile" onClick={logout}>
            <span className="avatar">
              {(user.displayName || user.email || "S")[0].toUpperCase()}
            </span>

            <span className="profile-info">
              <b>{user.displayName || "Sales executive"}</b>
              <small>{user.email}</small>
            </span>

            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="mobile-brand">
          <div className="brand-icon">ES</div>
          <b>ECHONIX Sales</b>
          <button className="icon-btn" onClick={logout} aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </header>

        {children}

        <footer className="footer">
          <span>ECHONIX · Sales workspace</span>
          <span>Cloud data · Firebase</span>
        </footer>
      </main>
    </div>
  );
}