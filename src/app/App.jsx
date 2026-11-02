import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "../features/auth/AuthProvider";
import AuthPage from "../features/auth/AuthPage";
import DashboardPage from "../features/dashboard/DashboardPage";
import ReportPage from "../features/reports/ReportPage";
import ExpensesPage from "../features/expenses/ExpensesPage";
import HistoryPage from "../features/reports/HistoryPage";
import AppShell from "../components/AppShell";
import ExpenseHistoryPage from "../features/expenses/ExpenseHistoryPage";
import CashSettlementPage from "../features/settlements/CashSettlementPage";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading workspace...</div>;
  }

  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading workspace...</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <AuthPage />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/report"
        element={
          <ProtectedRoute>
            <AppShell>
              <ReportPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
  path="/settlements"
  element={
    <AppShell><CashSettlementPage /></AppShell>
  }
/>

      <Route
        path="/expenses"
        element={
          <ProtectedRoute>
            <AppShell>
              <ExpensesPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
  path="/expense-history"
  element={
    <AppShell>
      <ExpenseHistoryPage />
    </AppShell>
  }
/>

      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <AppShell>
              <HistoryPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={<Navigate to={user ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}