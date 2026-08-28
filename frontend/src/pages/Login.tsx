import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface LoginProps {
  mode?: "public" | "admin" | "franchise";
}

export default function Login({ mode = "public" }: LoginProps) {
  const initialRole = mode === "admin" ? "ADMIN" : mode === "franchise" ? "FRANCHISE" : "MEMBER";
  const [role, setRole] = useState<"MEMBER" | "VENDOR" | "ADMIN" | "FRANCHISE">(initialRole);
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!mobile.trim()) {
      setError(`Please enter a valid ${role === "ADMIN" ? "Email" : "ID, Card, or Mobile"}.`);
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      let endpoint = "";
      if (role === "ADMIN") {
        endpoint = "/api/auth/admin/login";
      } else if (role === "VENDOR") {
        endpoint = "/api/vendors/login";
      } else if (role === "FRANCHISE") {
        endpoint = "/api/franchise/login";
      } else {
        endpoint = "/api/auth/login";
      }

      const payload =
        role === "ADMIN"
          ? { email: mobile.trim(), password }
          : { mobile: mobile.trim(), password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const token = data.data.token;
        const user = data.data.member || data.data.vendor || data.data.admin || data.data.franchise;
        const ctx = data.data.loginContext || null;

        login(token, role === "FRANCHISE" ? "MEMBER" : role, user, ctx);

        // Redirect based on role
        if (role === "ADMIN") {
          navigate("/admin-dashboard");
        } else if (role === "VENDOR") {
          navigate("/vendor-dashboard");
        } else {
          navigate("/dashboard");
        }
      } else {
        setError(data.error?.message || "Invalid credentials. Please verify details.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  const styles = `
    :root {
      --navy: #0d1b2a;
      --navy-2: #14263b;
      --teal: #0f9d9d;
      --teal-dark: #0b7c7c;
      --amber: #f5a623;
      --bg: #f4f7fb;
      --card: #ffffff;
      --text: #17233a;
      --muted: #64748b;
      --border: #dbe4ef;
      --success: #16a34a;
      --warning: #d97706;
      --danger: #dc2626;
      --info: #0369a1;
      --radius-card: 12px;
      --radius-btn: 8px;
      --shadow: 0 10px 30px rgba(13, 27, 42, 0.08);
    }

    .topbar {
      background: var(--navy); color: #fff; padding: 14px 22px;
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
    }

    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; text-decoration: none; color: #fff; }
    .brand-badge {
      width: 34px; height: 34px; border-radius: 50%;
      background: radial-gradient(circle at center, var(--amber) 0 26%, var(--teal) 27% 54%, var(--navy-2) 55% 100%);
    }

    .container { width: min(680px, calc(100% - 32px)); margin: 24px auto 40px; }

    .card {
      background: var(--card); border: 1px solid var(--border);
      border-radius: var(--radius-card); box-shadow: var(--shadow);
    }

    .panel { padding: 22px; text-align: left; }
    .panel h2 { font-size: 20px; color: var(--navy); margin-bottom: 6px; }
    .panel .subtitle { color: var(--muted); font-size: 14px; margin-bottom: 16px; }

    .stepper {
      display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; justify-content: center;
    }
    .step-dot {
      display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700;
      color: var(--muted); padding: 6px 14px; border-radius: 999px; border: 1px solid var(--border);
      cursor: pointer; background: #fff; transition: all 0.2s ease;
    }
    .step-dot.active { background: var(--navy); color: #fff; border-color: var(--navy); }
    .step-dot:hover { border-color: var(--teal); }

    .field-label { display: block; font-size: 13px; font-weight: 700; color: var(--navy); margin: 14px 0 6px; }
    .field-label .hindi { font-weight: 400; color: var(--muted); }

    input {
      width: 100%; border: 1px solid var(--border); border-radius: 10px;
      padding: 12px; font-size: 15px; color: var(--navy); background: #fff; outline: none;
    }
    input:focus { border-color: var(--teal); }

    .btn-primary {
      width: 100%; margin-top: 16px; background: var(--teal); color: #fff; border: none;
      padding: 14px 16px; border-radius: var(--radius-btn); font-size: 15px; font-weight: 700; cursor: pointer;
    }
    .btn-primary:hover { background: var(--teal-dark); }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }

    .note {
      border-left: 4px solid var(--teal); background: #f3fbfb; color: #155e5e;
      padding: 11px 12px; border-radius: 8px; font-size: 13px; margin-top: 14px;
    }
    .note.error { border-left-color: var(--danger); background: #fee2e2; color: #991b1b; }

    .toggle-link { text-align: center; margin-top: 16px; font-size: 13.5px; }
    .toggle-link a { color: var(--teal); text-decoration: none; font-weight: 700; }
  `;

  return (
    <div style={{ background: "linear-gradient(180deg, #f8fbff 0%, #f4f7fb 100%)", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* TOPBAR */}
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-badge"></span>
          <span>Bharatiya Bazaar · भारतीय बाज़ार</span>
        </Link>
        <Link to="/" style={{ color: "#fff", textDecoration: "none", fontSize: "14px" }}>← Home</Link>
      </header>

      <main className="container">
        {/* Portal selection tabs based on view mode */}
        {mode === "public" && (
          <div className="stepper">
            <span className={`step-dot ${role === "MEMBER" ? "active" : ""}`} onClick={() => { setRole("MEMBER"); setError(null); }}>
              Member Login
            </span>
            <span className={`step-dot ${role === "VENDOR" ? "active" : ""}`} onClick={() => { setRole("VENDOR"); setError(null); }}>
              Merchant Login
            </span>
          </div>
        )}
        {mode === "admin" && (
          <div className="stepper">
            <span className="step-dot active">
              Admin Login
            </span>
          </div>
        )}
        {mode === "franchise" && (
          <div className="stepper">
            <span className="step-dot active">
              Franchise Login
            </span>
          </div>
        )}

        {/* Login Panel */}
        <section className="card panel">
          <h2>Welcome Back</h2>
          <p className="subtitle">
            {role === "MEMBER" && "Login to access your member dashboard & wallet"}
            {role === "VENDOR" && "Login to manage your merchant outlet & settlements"}
            {role === "ADMIN" && "Login to access administrative control & verification panels"}
            {role === "FRANCHISE" && "Login to access your local franchise node panel"}
          </p>

          <form onSubmit={handleLoginSubmit}>
            {role === "ADMIN" ? (
              <>
                <label className="field-label">
                  Admin Email Address <span className="hindi">प्रशासक ईमेल</span>
                </label>
                <input
                  type="email"
                  placeholder="admin@bharatiyabazaar.com"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  required
                />
              </>
            ) : role === "FRANCHISE" ? (
              <>
                <label className="field-label">
                  Franchise Code, Mobile, or Email <span className="hindi">फ्रेंचाइजी कोड / मोबाइल / ईमेल</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. FR10001 or 9876543210"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  required
                />
              </>
            ) : (
              <>
                <label className="field-label">
                  {role === "MEMBER" ? "Member ID, Card Number, or Mobile" : "Merchant Mobile or ID"}{" "}
                  <span className="hindi">{role === "MEMBER" ? "सदस्य ID / कार्ड / मोबाइल" : "मोबाइल नंबर / ID"}</span>
                </label>
                <input
                  type="text"
                  placeholder={role === "MEMBER" ? "e.g. BB10015, SB10016, or 9876543210" : "e.g. V10002 or 9876543210"}
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  required
                />
              </>
            )}

            <label className="field-label">
              Password <span className="hindi">पासवर्ड</span>
            </label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            {error && <div className="note error">{error}</div>}

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Authenticating..." : "Login"}
            </button>
          </form>

          <div className="toggle-link">
            New to Bharatiya Bazaar?{" "}
            {role === "VENDOR" ? (
              <Link to="/vendor-register">Register as Merchant</Link>
            ) : role === "FRANCHISE" ? (
              <Link to="/register">Register as Member</Link>
            ) : (
              <Link to="/register">Register Now</Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
