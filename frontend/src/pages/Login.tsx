import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn, ShieldAlert, Store, UserCheck, ArrowLeft } from "lucide-react";

export default function Login() {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent, type: "MEMBER" | "VENDOR" | "ADMIN") => {
    e.preventDefault();
    if (!mobile || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const endpoint =
        type === "ADMIN"
          ? "/api/auth/admin/login"
          : type === "VENDOR"
          ? "/api/vendors/login"
          : "/api/auth/login";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, email: mobile, password })
      });

      const data = await res.json();

      if (data.success) {
        // Successful login
        const token = data.data.token;
        const user = data.data.member || data.data.vendor || data.data.admin;
        const role = type;
        const ctx = data.data.loginContext || null;

        login(token, role, user, ctx);

        // Redirect based on role
        if (role === "ADMIN") {
          navigate("/admin-dashboard");
        } else if (role === "VENDOR") {
          navigate("/vendor-dashboard");
        } else {
          navigate("/dashboard");
        }
      } else {
        setError(data.error?.message || "Invalid credentials. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("Server connection failure. Please verify backend state.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "480px", margin: "60px auto", padding: "0 20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "var(--text-secondary)" }}>
          <ArrowLeft size={16} /> Back to home
        </Link>
      </div>

      <div className="glass-card">
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 800 }}>Account Login</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Sign in to access your cooperative profile
          </p>
        </div>

        {error && (
          <div className="alert-box alert-danger">
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Selection */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "24px",
            background: "rgba(255,255,255,0.02)",
            padding: "4px",
            borderRadius: "var(--radius-sm)"
          }}
        >
          {/* Member Login panel */}
          <button
            onClick={() => handleLoginSubmit("MEMBER")}
            style={{
              flex: 1,
              padding: "10px",
              background: "var(--primary)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Member
          </button>
        </div>

        <form onSubmit={e => handleLogin(e, "MEMBER")}>
          <div className="form-group">
            <label className="form-label">Username / Card Number / Mobile</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. BB10001 or 9876543210"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: "24px" }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            <LogIn size={18} /> {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        {/* Alternate login access */}
        <div style={{ marginTop: "24px", display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
          <button
            onClick={e => {
              setMobile("");
              setPassword("");
              setError(null);
              // prompt for Merchant login
              const m = prompt("Enter Partner Merchant Mobile/ID:");
              const p = prompt("Enter Password:");
              if (m && p) {
                setMobile(m);
                setPassword(p);
                // Trigger vendor login
                const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                setTimeout(() => handleLogin(fakeEvent, "VENDOR"), 100);
              }
            }}
            style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
          >
            <Store size={14} /> Merchant Portal
          </button>

          <button
            onClick={e => {
              setMobile("");
              setPassword("");
              setError(null);
              const m = prompt("Enter Admin Email:");
              const p = prompt("Enter Password:");
              if (m && p) {
                setMobile(m);
                setPassword(p);
                // Trigger admin login
                const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                setTimeout(() => handleLogin(fakeEvent, "ADMIN"), 100);
              }
            }}
            style={{ background: "none", border: "none", color: "var(--info)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
          >
            <UserCheck size={14} /> Admin Access
          </button>
        </div>

        <div style={{ marginTop: "24px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "20px", textAlign: "center", fontSize: "14px" }}>
          <span style={{ color: "var(--text-secondary)" }}>New to Bharatiya Bazaar?</span>{" "}
          <Link to="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );

  function handleLoginSubmit(type: "MEMBER" | "VENDOR" | "ADMIN") {
    // Just helper to reset fields
    setError(null);
  }
}
