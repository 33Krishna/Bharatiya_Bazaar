import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function SetuKosh() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [counterData, setCounterData] = useState<any>(null);

  // Tree explorer
  const [rootPosInput, setRootPosInput] = useState<number>(1);
  const [treeResult, setTreeResult] = useState<any>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      logout();
      navigate("/login");
      return;
    }
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch("/api/setu-kosh/counter", { headers }).then(r => r.json());
      if (res.success) {
        setCounterData(res.data);
      }
      await loadExplorerTree(1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadExplorerTree = async (pos: number) => {
    setTreeLoading(true);
    setTreeError(null);
    try {
      const res = await fetch(`/api/setu-kosh/tree?root=${pos}&depth=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Node not found");
      }
      setTreeResult(data.data);
    } catch (err: any) {
      setTreeError(err.message);
      setTreeResult(null);
    } finally {
      setTreeLoading(false);
    }
  };

  const handleLoadTreeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadExplorerTree(rootPosInput);
  };

  const formatINR = (paise: number) => {
    return "₹" + (Number(paise || 0) / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const renderTreeBranch = (node: any, depth: number): React.ReactNode => {
    if (!node) return null;
    const isLeft = node.side === "LEFT";
    const icon = isLeft ? "◀ L" : "R ▶";

    return (
      <div key={node.position} style={{ fontFamily: "monospace", fontSize: "13px", lineHeight: "1.6", whiteSpace: "pre" }}>
        {"    ".repeat(depth)}
        <strong>{icon} Pos #{node.position} (L{node.level}):</strong> {node.memberName} ({node.memberCode})
        {node.children?.LEFT && renderTreeBranch(node.children.LEFT, depth + 1)}
        {node.children?.RIGHT && renderTreeBranch(node.children.RIGHT, depth + 1)}
      </div>
    );
  };

  if (loading) {
    return <div className="loading">Loading Setu Kosh dashboard...</div>;
  }

  // Counter calculation variables
  const current = counterData?.counterPaise || 0;
  const target = counterData?.thresholdPaise || 100000;
  const pct = Math.min(100, Math.floor((current * 100) / target));
  const rem = Math.max(0, target - current);

  const referralBonuses = counterData?.referralBonuses || [];

  return (
    <div style={{ width: "100%" }}>
      <div className="page-head">
        <h1>Setu Kosh</h1>
        <p>Your shopping spends progression, network trees, and referral earnings.</p>
      </div>

      {/* Progress card */}
      <section className="card panel">
        <h2>1. Shopping Progress & Counter</h2>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", alignItems: "start", marginTop: "14px" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14.5px", fontWeight: "600", marginBottom: "8px" }}>
              <span>Shopping Progress: {formatINR(current)} / {formatINR(target)}</span>
              <span>{pct}% Complete</span>
            </div>
            <div style={{ width: "100%", height: "14px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden", position: "relative" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, var(--teal) 0%, var(--teal-dark) 100%)", borderRadius: "999px" }}></div>
            </div>
            <div style={{ marginTop: "6px", fontSize: "13px", color: "var(--muted)", fontWeight: "600" }}>
              {formatINR(rem)} remaining for next ID
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px", background: "#fbfdff" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: "600", textTransform: "uppercase" }}>Total IDs Earned</div>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--navy)", marginTop: "4px" }}>{counterData?.idsCreated || 0}</div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px", background: "#fbfdff" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: "600", textTransform: "uppercase" }}>Accumulated Margin</div>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--navy)", marginTop: "4px" }}>{formatINR(counterData?.accumulatedMarginPaise || 0)}</div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px", background: "#fbfdff" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: "600", textTransform: "uppercase" }}>Next generated ID type</div>
              <div style={{ fontSize: "16px", fontWeight: "800", color: "var(--teal)", marginTop: "4px" }}>SUB CARD</div>
            </div>
          </div>
        </div>
      </section>

      {/* Setu Kosh tree explorer */}
      <section className="card panel" style={{ marginTop: "20px" }}>
        <h2>2. Setu Kosh 10-Level Tree Explorer</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "14px" }}>
          Inspect the binary placement structure of Setu Kosh nodes funding upline shoppers.
        </p>

        <form onSubmit={handleLoadTreeSubmit} style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px" }}>
          <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--navy)" }} htmlFor="treeRootPos">Root Position #</label>
          <input
            type="number"
            id="treeRootPos"
            min="1"
            style={{ width: "100px", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
            value={rootPosInput}
            onChange={e => setRootPosInput(Math.max(1, parseInt(e.target.value) || 1))}
          />
          <button className="topbar-btn primary" style={{ fontSize: "12px", padding: "6px 14px" }} type="submit" disabled={treeLoading}>
            {treeLoading ? "Loading..." : "Load Tree"}
          </button>
        </form>

        <div style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", background: "#fafbfc", minHeight: "150px", overflowX: "auto" }}>
          {treeError && <span style={{ color: "var(--danger)" }}>{treeError}</span>}
          {treeLoading && <div className="loading" style={{ padding: "20px 0" }}>Loading Setu Kosh Tree Explorer...</div>}
          {!treeLoading && !treeError && treeResult && (
            <div>
              <div style={{ marginBottom: "14px", borderBottom: "1px dashed var(--border)", paddingBottom: "8px" }}>
                <strong>Root Node #{treeResult.rootNode.globalPosition}:</strong> {treeResult.rootNode.member?.name} ({treeResult.rootNode.member?.memberCode}) | Depth: Level {treeResult.rootNode.depthLevel}
              </div>
              <div>{renderTreeBranch(treeResult.tree, 0)}</div>
            </div>
          )}
        </div>
      </section>

      {/* Vendor referral bonuses table */}
      <section className="card panel" style={{ marginTop: "20px" }}>
        <h2>3. Vendor Referral Bonus Earnings</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "12px" }}>
          0.25% (25 bps) perpetual referral bonus on every customer purchase at stores you referred.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Referred Store</th>
                <th>Category</th>
                <th>Customer Purchase</th>
                <th>Bonus Earned (0.25%)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {referralBonuses.length > 0 ? (
                referralBonuses.map((b: any, idx: number) => (
                  <tr key={idx}>
                    <td>{formatDate(b.createdAt)}</td>
                    <td><strong>{b.vendor?.businessName || "Store"}</strong></td>
                    <td><span className="badge info">{b.vendor?.category || "GENERAL"}</span></td>
                    <td>{formatINR(b.purchaseAmountPaise)}</td>
                    <td><strong style={{ color: "var(--success)" }}>{formatINR(b.bonusPaise)}</strong></td>
                    <td><span className={`badge ${b.status === "WITHDRAWABLE" ? "success" : "warning"}`}>{b.status}</span></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "20px", color: "var(--muted)" }}>
                    No vendor referral bonuses earned yet. Refer local stores to start earning 0.25% on every customer purchase!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
