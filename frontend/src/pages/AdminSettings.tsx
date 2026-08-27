import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Settings, Save, Edit, RefreshCw } from "lucide-react";

export default function AdminSettings() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const fetchSettings = () => {
    if (!token) return;
    setLoading(true);
    fetch("/api/admin/settings", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setSettings(res.data);
        }
      })
      .catch(err => console.error("Error fetching settings:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const handleEditClick = (key: string, value: string) => {
    setEditingKey(key);
    setEditingValue(value);
    setMessage(null);
  };

  const handleSaveSetting = async (key: string) => {
    try {
      const res = await fetch(`/api/admin/settings/${key}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ value: editingValue })
      });

      const data = await res.json();
      if (data.success) {
        setMessage(`Success: Updated ${key} to "${editingValue}"`);
        setEditingKey(null);
        fetchSettings();
      } else {
        setMessage(`Error: ${data.error?.message || "Failed to update setting."}`);
      }
    } catch (e) {
      setMessage("Error sending settings update request.");
    }
  };

  if (loading) {
    return <div style={{ color: "var(--text-secondary)" }}>Loading platform configuration settings...</div>;
  }

  // Filter margins settings vs core rule settings
  const marginSettings = settings.filter(s => s.key.startsWith("CATEGORY_MARGIN_") || s.key.startsWith("VENDOR_MARGIN_"));
  const coreSettings = settings.filter(s => !s.key.startsWith("CATEGORY_MARGIN_") && !s.key.startsWith("VENDOR_MARGIN_"));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title text-gradient">System Properties</h1>
          <p className="text-secondary" style={{ fontSize: "14px", marginTop: "4px" }}>
            Dynamically adjust statutory thresholds, withdrawal percentage parameters, and business tree constraints.
          </p>
        </div>
      </div>

      {message && (
        <div className={`alert-box ${message.startsWith("Error") ? "alert-danger" : "alert-info"}`} style={{ marginBottom: "24px" }}>
          <span>{message}</span>
        </div>
      )}

      {/* Grid splits */}
      <div className="grid-cols-1-3">
        {/* Core Rules Settings */}
        <div className="glass-card">
          <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Settings size={18} color="var(--primary)" /> Core Platform Parameters
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {coreSettings.map(s => {
              const isEditing = editingKey === s.key;
              return (
                <div
                  key={s.key}
                  style={{
                    padding: "16px",
                    background: "rgba(255,255,255,0.01)",
                    border: "1px solid rgba(255,255,255,0.03)",
                    borderRadius: "var(--radius-sm)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                    <strong style={{ fontSize: "14px", color: "var(--primary)", fontFamily: "monospace" }}>{s.key}</strong>
                    
                    {isEditing ? (
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          onClick={() => handleSaveSetting(s.key)}
                          className="btn btn-primary"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                        >
                          <Save size={12} /> Save
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="btn btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditClick(s.key, s.value)}
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "12px" }}
                      >
                        <Edit size={12} /> Edit
                      </button>
                    )}
                  </div>
                  
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>{s.description}</p>
                  
                  {isEditing ? (
                    <input
                      type="text"
                      className="form-input"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      style={{ fontSize: "13px", padding: "8px 12px" }}
                    />
                  ) : (
                    <div style={{ background: "rgba(0,0,0,0.2)", padding: "8px 12px", borderRadius: "4px", fontSize: "14px", fontWeight: 700, fontFamily: "monospace" }}>
                      {s.value}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Store Category Margins */}
        <div className="glass-card">
          <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <RefreshCw size={18} color="var(--success)" /> Store Category Margins
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {marginSettings.map(s => {
              const isEditing = editingKey === s.key;
              return (
                <div
                  key={s.key}
                  style={{
                    padding: "16px",
                    background: "rgba(255,255,255,0.01)",
                    border: "1px solid rgba(255,255,255,0.03)",
                    borderRadius: "var(--radius-sm)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                    <strong style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                      {s.key.replace("CATEGORY_MARGIN_", "").toLowerCase()}
                    </strong>
                    
                    {isEditing ? (
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          onClick={() => handleSaveSetting(s.key)}
                          className="btn btn-primary"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                        >
                          <Save size={12} />
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="btn btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditClick(s.key, s.value)}
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "12px" }}
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      style={{ fontSize: "13px", padding: "8px 12px" }}
                    />
                  ) : (
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--primary)" }}>
                      {s.value}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
