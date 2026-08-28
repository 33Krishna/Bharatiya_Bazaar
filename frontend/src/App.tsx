import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";

// Guest Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VendorRegister from "./pages/VendorRegister";
import Calculator from "./pages/Calculator";

// Member Pages
import Dashboard from "./pages/Dashboard";
import MySystem from "./pages/MySystem";
import AutoPool from "./pages/AutoPool";
import SetuKosh from "./pages/SetuKosh";
import Wallet from "./pages/Wallet";
import Commissions from "./pages/Commissions";

// Vendor Pages
import VendorDashboard from "./pages/VendorDashboard";

// Admin Pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminKyc from "./pages/AdminKyc";
import AdminPayouts from "./pages/AdminPayouts";
import AdminReports from "./pages/AdminReports";
import AdminSettings from "./pages/AdminSettings";
import AdminDisputes from "./pages/AdminDisputes";

// Route Guard component
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles: ("MEMBER" | "VENDOR" | "ADMIN")[];
}> = ({ children, allowedRoles }) => {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  // Allow guest access to the wallet page calculation preview
  const isGuestWallet = location.pathname === "/wallet" && new URLSearchParams(location.search).get("guest") === "true";
  
  if (isGuestWallet) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && !allowedRoles.includes(role)) {
    // Redirect to their respective dashboards
    if (role === "ADMIN") return <Navigate to="/admin-dashboard" replace />;
    if (role === "VENDOR") return <Navigate to="/vendor-dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Guest/Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login mode="public" />} />
          <Route path="/admin-login" element={<Login mode="admin" />} />
          <Route path="/franchise-login" element={<Login mode="franchise" />} />
          <Route path="/register" element={<Register />} />
          <Route path="/vendor-register" element={<VendorRegister />} />
          <Route path="/calculator" element={<Calculator />} />

          {/* Member Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={["MEMBER"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-system"
            element={
              <ProtectedRoute allowedRoles={["MEMBER"]}>
                <MySystem />
              </ProtectedRoute>
            }
          />
          <Route
            path="/autopool"
            element={
              <ProtectedRoute allowedRoles={["MEMBER"]}>
                <AutoPool />
              </ProtectedRoute>
            }
          />
          <Route
            path="/setu-kosh"
            element={
              <ProtectedRoute allowedRoles={["MEMBER"]}>
                <SetuKosh />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wallet"
            element={
              <ProtectedRoute allowedRoles={["MEMBER"]}>
                <Wallet />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissions"
            element={
              <ProtectedRoute allowedRoles={["MEMBER"]}>
                <Commissions />
              </ProtectedRoute>
            }
          />

          {/* Vendor Protected Routes */}
          <Route
            path="/vendor-dashboard"
            element={
              <ProtectedRoute allowedRoles={["VENDOR"]}>
                <VendorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor-settlements"
            element={
              <ProtectedRoute allowedRoles={["VENDOR"]}>
                <VendorDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin Protected Routes */}
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-kyc"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminKyc />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-payouts"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminPayouts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-reports"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-settings"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-disputes"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminDisputes />
              </ProtectedRoute>
            }
          />

          {/* Fallback Catch-all Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
