import React, { useState, useEffect, useCallback } from "react";

const S = {
  root: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: "#333",
    padding: "16px 0",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 10,
    marginTop: 24,
  },
  btn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnPrimary: { background: "#3b82f6", color: "#fff" },
  btnDanger: {
    background: "#ef4444",
    color: "#fff",
    padding: "6px 12px",
    fontSize: 12,
  },
  btnWarning: {
    background: "#f59e0b",
    color: "#fff",
    padding: "6px 12px",
    fontSize: 12,
  },
  btnSave: { background: "#3b82f6", color: "#fff" },
  btnSuccess: { background: "#10b981", color: "#fff" },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  status: { marginTop: 8, fontSize: 12, minHeight: 18 },
  runtimeCard: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 18px",
    background: "#f8f9fa",
    border: "1px solid #e0e0e0",
    borderRadius: 10,
    marginBottom: 12,
  },
  runtimeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    flexShrink: 0,
  },
  runtimeInfo: { flex: 1 },
  runtimeName: { fontSize: 15, fontWeight: 600, color: "#333" },
  runtimeVersion: { fontSize: 12, color: "#888" },
  containerItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    background: "#f8f9fa",
    border: "1px solid #e0e0e0",
    borderRadius: 10,
    marginBottom: 8,
  },
  stateIndicator: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  },
  containerInfo: { flex: 1, minWidth: 0 },
  containerName: { fontSize: 14, fontWeight: 600, color: "#333" },
  containerMeta: {
    fontSize: 11,
    color: "#888",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  containerActions: {
    display: "flex",
    gap: 6,
    flexShrink: 0,
  },
  // Resource-limits editor styles (v0.1.7)
  containerCard: {
    // Wraps the existing containerItem + the optional inline editor
    // so they visually read as one card.
    background: "#f8f9fa",
    border: "1px solid #e0e0e0",
    borderRadius: 10,
    marginBottom: 8,
    overflow: "hidden",
  },
  containerItemFlat: {
    // containerItem but without the border/background/margin
    // (those come from containerCard now) and without the
    // independent border-radius.
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
  },
  limitsRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 14px 10px 34px",
    fontSize: 11,
    color: "#666",
    flexWrap: "wrap",
  },
  limitBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 12,
    background: "#e5e7eb",
    color: "#374151",
    fontSize: 11,
    fontWeight: 500,
  },
  overrideBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 12,
    background: "#fef3c7",
    color: "#92400e",
    fontSize: 10,
    fontWeight: 600,
  },
  editLimitsBtn: {
    marginLeft: "auto",
    padding: "3px 10px",
    fontSize: 11,
    background: "#fff",
    color: "#3b82f6",
    border: "1px solid #3b82f6",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 500,
  },
  limitsEditor: {
    borderTop: "1px solid #e0e0e0",
    padding: "14px 14px 14px 34px",
    background: "#fff",
  },
  limitsEditorGrid: {
    display: "grid",
    gridTemplateColumns: "160px 1fr auto",
    gap: "8px 12px",
    alignItems: "center",
    marginBottom: 10,
  },
  limitsEditorLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: "#555",
  },
  limitsEditorInput: {
    padding: "5px 8px",
    borderRadius: 5,
    border: "1px solid #ccc",
    fontSize: 12,
    background: "#fff",
    color: "#333",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  },
  limitsEditorInputDisabled: {
    background: "#f3f4f6",
    color: "#9ca3af",
    fontStyle: "italic",
  },
  limitsEditorUnsetBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 1,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  limitsEditorUnsetBtnActive: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fca5a5",
  },
  limitsEditorAdvancedToggle: {
    fontSize: 11,
    color: "#3b82f6",
    cursor: "pointer",
    userSelect: "none",
    marginTop: 6,
    marginBottom: 10,
    display: "inline-block",
  },
  limitsEditorActions: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 10,
  },
  limitsEditorResult: {
    marginTop: 10,
    padding: "8px 10px",
    borderRadius: 6,
    fontSize: 11,
    lineHeight: 1.5,
  },
  limitsEditorResultLive: {
    background: "#d1fae5",
    color: "#065f46",
  },
  limitsEditorResultRecreated: {
    background: "#fef3c7",
    color: "#92400e",
  },
  limitsEditorResultError: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  limitsEditorWarning: {
    marginTop: 4,
    fontSize: 10,
    opacity: 0.85,
    fontStyle: "italic",
  },
  empty: {
    textAlign: "center",
    padding: "30px 16px",
    color: "#999",
    fontSize: 13,
  },
  fieldRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    width: 160,
    flexShrink: 0,
  },
  select: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #ccc",
    fontSize: 13,
    background: "#fff",
    color: "#333",
  },
  hint: { fontSize: 11, color: "#aaa", marginLeft: 8 },
  pruneResult: {
    fontSize: 12,
    color: "#10b981",
    marginTop: 6,
  },
};

const stateColors = {
  running: "#10b981",
  stopped: "#f59e0b",
  missing: "#94a3b8",
  "no-runtime": "#ef4444",
};

const stateLabels = {
  running: "Running",
  stopped: "Stopped",
  missing: "Not created",
  "no-runtime": "No runtime",
};

function SelectField({ label, value, options, onChange, hint }) {
  return (
    <div style={S.fieldRow}>
      <span style={S.label}>{label}</span>
      <select
        style={S.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span style={S.hint}>{hint}</span>}
    </div>
  );
}

function ToggleField({ label, value, onChange, hint }) {
  return (
    <div style={S.fieldRow}>
      <span style={S.label}>{label}</span>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          cursor: "pointer",
          gap: 8,
        }}
      >
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 16, height: 16, cursor: "pointer" }}
        />
        <span style={{ fontSize: 13, color: "#555" }}>
          {value ? "Enabled" : "Disabled"}
        </span>
      </label>
      {hint && <span style={S.hint}>{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resource limits editor (v0.1.7)
// ---------------------------------------------------------------------------

/**
 * Strip the `sk-` prefix that signalk-container adds to all managed
 * containers. REST endpoints under /api/containers/:name/resources and
 * the containerOverrides config key both use the UNPREFIXED form.
 */
function unprefixed(name) {
  return name && name.startsWith("sk-") ? name.slice(3) : name;
}

/**
 * Describes a single field in the resource-limits editor. The `primary`
 * flag controls whether the field is visible by default; the rest are
 * hidden behind an "Advanced" toggle.
 */
const RESOURCE_FIELDS = [
  {
    key: "cpus",
    label: "CPU (cores)",
    type: "number",
    step: "0.1",
    min: "0.1",
    placeholder: "e.g. 1.5",
    primary: true,
  },
  {
    key: "memory",
    label: "Memory",
    type: "text",
    placeholder: "e.g. 512m, 2g",
    primary: true,
  },
  {
    key: "memorySwap",
    label: "Memory + swap",
    type: "text",
    placeholder: "= memory to disable swap",
    primary: true,
  },
  {
    key: "pidsLimit",
    label: "Max processes",
    type: "number",
    step: "1",
    min: "1",
    placeholder: "e.g. 200",
    primary: true,
  },
  {
    key: "cpuShares",
    label: "CPU shares (weight)",
    type: "number",
    step: "1",
    min: "2",
    placeholder: "default 1024",
    primary: false,
  },
  {
    key: "cpusetCpus",
    label: "Pin to CPUs",
    type: "text",
    placeholder: 'e.g. "0,1" or "1-3"',
    primary: false,
  },
  {
    key: "memoryReservation",
    label: "Memory reservation",
    type: "text",
    placeholder: "soft floor, e.g. 256m",
    primary: false,
  },
  {
    key: "oomScoreAdj",
    label: "OOM score adjust",
    type: "number",
    step: "1",
    min: "-1000",
    max: "1000",
    placeholder: "-1000 to 1000",
    primary: false,
  },
];

/**
 * Normalize a value read from the form state into the right shape for
 * the POST body:
 *   - null → null (explicit unset)
 *   - undefined or "" → omitted (don't send)
 *   - number field → parsed as Number
 *   - text field → string as-is
 */
function buildLimitsPayload(formState) {
  const out = {};
  for (const f of RESOURCE_FIELDS) {
    const v = formState[f.key];
    if (v === null) {
      out[f.key] = null;
      continue;
    }
    if (v === undefined || v === "") continue;
    if (f.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      out[f.key] = n;
    } else {
      out[f.key] = v;
    }
  }
  return out;
}

/**
 * Render a current effective limit as a compact badge string.
 * Returns null if the value is missing/empty.
 */
function formatLimitBadge(key, value) {
  if (value === undefined || value === null || value === "") return null;
  switch (key) {
    case "cpus":
      return `${value} CPU`;
    case "memory":
      return `${value}`;
    case "memorySwap":
      return `swap: ${value}`;
    case "memoryReservation":
      return `reserve: ${value}`;
    case "pidsLimit":
      return `${value} PIDs`;
    case "cpuShares":
      return `shares: ${value}`;
    case "cpusetCpus":
      return `cpus: ${value}`;
    case "oomScoreAdj":
      return `oom: ${value}`;
    default:
      return `${key}: ${value}`;
  }
}

function ResourceLimitsEditor({
  containerName, // unprefixed
  effective, // ContainerResourceLimits (merged plugin default + override)
  initialOverride, // ContainerResourceLimits or undefined
  onApply, // (formState) => Promise<{ method, warnings?, error? }>
  onClose,
}) {
  // Seed form state from the effective limits (what's actually applied)
  // rather than just the user override. This gives the user a visible
  // starting point they can edit, including whatever the plugin default
  // set. They can unset fields individually via the × button.
  const seed = () => {
    const s = {};
    for (const f of RESOURCE_FIELDS) {
      if (
        effective &&
        effective[f.key] !== undefined &&
        effective[f.key] !== null
      ) {
        s[f.key] = String(effective[f.key]);
      } else {
        s[f.key] = "";
      }
    }
    return s;
  };

  const [formState, setFormState] = useState(seed);
  const [showAdvanced, setShowAdvanced] = useState(() => {
    // Open Advanced section by default if the override already uses
    // any of the non-primary fields — otherwise the user would be
    // confused about where their cpuset went.
    if (!initialOverride) return false;
    return RESOURCE_FIELDS.some(
      (f) => !f.primary && initialOverride[f.key] !== undefined,
    );
  });
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  const updateField = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const toggleUnset = (key) => {
    setFormState((prev) => ({
      ...prev,
      [key]: prev[key] === null ? "" : null,
    }));
  };

  const doReset = () => {
    setFormState(seed());
    setResult(null);
  };

  const doApply = async () => {
    setApplying(true);
    setResult(null);
    try {
      const payload = buildLimitsPayload(formState);
      const res = await onApply(payload);
      setResult(res);
      // On success, re-seed the form from the new effective state
      // via the parent (which will pass updated `effective` prop).
      // We don't clear formState here — the user can see what they
      // just applied.
    } catch (err) {
      setResult({ error: err.message || String(err) });
    }
    setApplying(false);
  };

  const renderField = (f) => {
    const val = formState[f.key];
    const isUnset = val === null;
    return (
      <React.Fragment key={f.key}>
        <label
          style={S.limitsEditorLabel}
          htmlFor={`lim-${containerName}-${f.key}`}
        >
          {f.label}
        </label>
        <input
          id={`lim-${containerName}-${f.key}`}
          type={isUnset ? "text" : f.type}
          value={isUnset ? "" : val}
          step={f.step}
          min={f.min}
          max={f.max}
          placeholder={isUnset ? "(unset — remove limit)" : f.placeholder}
          disabled={isUnset}
          onChange={(e) => updateField(f.key, e.target.value)}
          style={{
            ...S.limitsEditorInput,
            ...(isUnset ? S.limitsEditorInputDisabled : {}),
          }}
        />
        <button
          type="button"
          onClick={() => toggleUnset(f.key)}
          title={
            isUnset
              ? "Click to set a value again"
              : "Click to explicitly unset (remove this limit)"
          }
          style={{
            ...S.limitsEditorUnsetBtn,
            ...(isUnset ? S.limitsEditorUnsetBtnActive : {}),
          }}
        >
          {isUnset ? "↺" : "×"}
        </button>
      </React.Fragment>
    );
  };

  const primaryFields = RESOURCE_FIELDS.filter((f) => f.primary);
  const advancedFields = RESOURCE_FIELDS.filter((f) => !f.primary);

  return (
    <div style={S.limitsEditor}>
      <div style={S.limitsEditorGrid}>{primaryFields.map(renderField)}</div>

      <span
        onClick={() => setShowAdvanced(!showAdvanced)}
        style={S.limitsEditorAdvancedToggle}
      >
        {showAdvanced ? "▾" : "▸"} Advanced ({advancedFields.length} more
        fields)
      </span>

      {showAdvanced && (
        <div style={S.limitsEditorGrid}>{advancedFields.map(renderField)}</div>
      )}

      <div style={S.limitsEditorActions}>
        <button
          type="button"
          onClick={onClose}
          style={{
            ...S.btn,
            padding: "6px 12px",
            fontSize: 12,
            background: "#fff",
            color: "#6b7280",
            border: "1px solid #d1d5db",
          }}
        >
          Close
        </button>
        <button
          type="button"
          onClick={doReset}
          style={{
            ...S.btn,
            padding: "6px 12px",
            fontSize: 12,
            background: "#fff",
            color: "#6b7280",
            border: "1px solid #d1d5db",
          }}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={doApply}
          disabled={applying}
          style={{
            ...S.btn,
            ...S.btnPrimary,
            padding: "6px 14px",
            fontSize: 12,
            ...(applying ? S.btnDisabled : {}),
          }}
        >
          {applying ? "Applying..." : "Apply"}
        </button>
      </div>

      {result && (
        <div
          style={{
            ...S.limitsEditorResult,
            ...(result.error
              ? S.limitsEditorResultError
              : result.method === "recreated"
                ? S.limitsEditorResultRecreated
                : S.limitsEditorResultLive),
          }}
        >
          {result.error ? (
            <>
              <strong>Error:</strong> {result.error}
            </>
          ) : (
            <>
              <strong>
                {result.method === "live"
                  ? "Applied live (no restart)"
                  : "Container recreated"}
              </strong>
              {result.warnings && result.warnings.length > 0 && (
                <div style={S.limitsEditorWarning}>
                  {result.warnings.map((w, i) => (
                    <div key={i}>⚠ {w}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function PluginConfigurationPanel({ configuration, save }) {
  const cfg = configuration || {};
  const [runtime, setRuntime] = useState(cfg.runtime || "auto");
  const [pruneSchedule, setPruneSchedule] = useState(
    cfg.pruneSchedule || "weekly",
  );
  // v0.1.5 schema fields — previously not rendered in this panel, meaning
  // they were invisible AND silently wiped by Save. v0.1.7 fixes both.
  const [updateCheckInterval, setUpdateCheckInterval] = useState(
    cfg.updateCheckInterval || "24h",
  );
  const [backgroundUpdateChecks, setBackgroundUpdateChecks] = useState(
    cfg.backgroundUpdateChecks !== false,
  );
  // containerOverrides is a Record<string, ContainerResourceLimits> keyed
  // by the UNPREFIXED container name. Spread into `doSave` so the global
  // Save Configuration button persists it alongside the other settings,
  // but the primary persistence path is now the backend's automatic
  // savePluginOptions inside updateResources. This React state is just a
  // cache for the Save button's round-trip.
  const [containerOverrides, setContainerOverrides] = useState(
    cfg.containerOverrides || {},
  );

  const [runtimeInfo, setRuntimeInfo] = useState(null);
  const [containers, setContainers] = useState([]);
  // Per-container effective resource limits, keyed by UNPREFIXED name.
  // Populated by fetchStatus() which hits /api/containers/:name/resources.
  const [effectiveLimits, setEffectiveLimits] = useState({});
  // Per-container `override` field as reported by the server, keyed by
  // UNPREFIXED name. The "Override active" badge derives from THIS, not
  // from the React containerOverrides state, so a browser reload (which
  // wipes local state and re-reads from the server) still shows the
  // badge correctly. A null value here means "no override recorded by
  // the server"; a non-null object (even an empty one) means "override
  // exists".
  const [overrideStates, setOverrideStates] = useState({});
  // Which container rows have their resource editor expanded.
  const [expandedLimits, setExpandedLimits] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [pruneResult, setPruneResult] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const [rtRes, ctRes] = await Promise.all([
        fetch("/plugins/signalk-container/api/runtime"),
        fetch("/plugins/signalk-container/api/containers"),
      ]);

      if (rtRes.ok) {
        setRuntimeInfo(await rtRes.json());
      } else {
        setRuntimeInfo(null);
      }

      let ctList = [];
      if (ctRes.ok) {
        ctList = await ctRes.json();
        setContainers(ctList);
      } else {
        setContainers([]);
      }

      // Fetch effective resource limits AND user-override state for each
      // container in parallel. Best-effort: failures just leave empty
      // badges rather than erroring the whole panel. Both fields are
      // keyed by the UNPREFIXED container name.
      if (ctList.length > 0) {
        const limitsMap = {};
        const overrideMap = {};
        await Promise.all(
          ctList.map(async (ct) => {
            const un = unprefixed(ct.name);
            try {
              const r = await fetch(
                `/plugins/signalk-container/api/containers/${encodeURIComponent(un)}/resources`,
              );
              if (r.ok) {
                const body = await r.json();
                limitsMap[un] = body.effective || {};
                overrideMap[un] = body.override ?? null;
              }
            } catch {
              // Best effort only.
            }
          }),
        );
        setEffectiveLimits(limitsMap);
        setOverrideStates(overrideMap);
      }
    } catch {
      setRuntimeInfo(null);
      setContainers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const toggleLimitsExpand = (name) => {
    const un = unprefixed(name);
    setExpandedLimits((prev) => {
      const next = new Set(prev);
      if (next.has(un)) next.delete(un);
      else next.add(un);
      return next;
    });
  };

  const applyLimits = async (unprefixedName, payload) => {
    const res = await fetch(
      `/plugins/signalk-container/api/containers/${encodeURIComponent(unprefixedName)}/resources`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        error: data.error || `${res.status} ${res.statusText}`,
      };
    }
    // Update the local effectiveLimits cache from the response so badges
    // refresh immediately without waiting for the next poll.
    if (data.effective) {
      setEffectiveLimits((prev) => ({
        ...prev,
        [unprefixedName]: data.effective,
      }));
    }
    // Update the local overrideStates cache from the response's
    // `override` field. This is what the "Override active" badge reads,
    // so the user sees the badge flip on immediately after Apply. The
    // backend (v0.1.8+) also persists this to plugin-config-data via
    // savePluginOptions, so a browser reload re-fetches it via
    // fetchStatus() and the badge reappears.
    setOverrideStates((prev) => ({
      ...prev,
      [unprefixedName]: data.override ?? null,
    }));
    // Keep the React containerOverrides state in sync too so the global
    // Save Configuration button's spread-then-overwrite path preserves
    // the same override. This is defense-in-depth — the backend already
    // persisted via savePluginOptions, but if the user clicks Save
    // Configuration they should see their overrides preserved.
    setContainerOverrides((prev) => {
      const next = { ...prev };
      if (data.override && Object.keys(data.override).length > 0) {
        next[unprefixedName] = data.override;
      } else {
        delete next[unprefixedName];
      }
      return next;
    });
    return {
      method: data.method,
      warnings: data.warnings,
    };
  };

  const doSave = () => {
    // CRITICAL: spread the existing cfg FIRST so any schema fields this
    // panel doesn't explicitly render are preserved through a save.
    // Without this, clicking Save would silently wipe new schema
    // fields (e.g. updateCheckInterval, backgroundUpdateChecks,
    // containerOverrides) that weren't visible in the form. Any
    // field we DO manage is written after the spread so our in-form
    // values win.
    //
    // For containerOverrides specifically: v0.1.8 has the backend
    // auto-persist on every Apply click via savePluginOptions, so
    // the disk state is usually ahead of any local React state.
    // To avoid overwriting that with stale React state, derive
    // containerOverrides from the server-reported overrideStates
    // (which the 5s poll keeps fresh). Skip null entries.
    const overridesFromServer = {};
    for (const [name, ov] of Object.entries(overrideStates)) {
      if (ov && Object.keys(ov).length > 0) {
        overridesFromServer[name] = ov;
      }
    }
    save({
      ...cfg,
      runtime,
      pruneSchedule,
      maxConcurrentJobs: cfg.maxConcurrentJobs || 2,
      updateCheckInterval,
      backgroundUpdateChecks,
      containerOverrides: overridesFromServer,
    });
    setActionStatus("Saved! Plugin will restart.");
    setStatusError(false);
  };

  const startContainer = async (name) => {
    setActionStatus(`Starting ${name}...`);
    setStatusError(false);
    try {
      const res = await fetch(
        `/plugins/signalk-container/api/containers/${encodeURIComponent(name)}/start`,
        { method: "POST" },
      );
      if (res.ok) {
        setActionStatus(`${name} started.`);
        fetchStatus();
      } else {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        setActionStatus(`Failed: ${data.error}`);
        setStatusError(true);
      }
    } catch (e) {
      setActionStatus(`Error: ${e.message}`);
      setStatusError(true);
    }
  };

  const stopContainer = async (name) => {
    setActionStatus(`Stopping ${name}...`);
    setStatusError(false);
    try {
      const res = await fetch(
        `/plugins/signalk-container/api/containers/${encodeURIComponent(name)}/stop`,
        { method: "POST" },
      );
      if (res.ok) {
        setActionStatus(`${name} stopped.`);
        fetchStatus();
      } else {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        setActionStatus(`Failed: ${data.error}`);
        setStatusError(true);
      }
    } catch (e) {
      setActionStatus(`Error: ${e.message}`);
      setStatusError(true);
    }
  };

  const removeContainer = async (name, state) => {
    if (state === "running") {
      if (!window.confirm(`${name} is running. Stop and remove it?`)) return;
    }
    setActionStatus(`Removing ${name}...`);
    setStatusError(false);
    try {
      const res = await fetch(
        `/plugins/signalk-container/api/containers/${encodeURIComponent(name)}/remove`,
        { method: "POST" },
      );
      if (res.ok) {
        setActionStatus(`${name} removed.`);
        fetchStatus();
      } else {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        setActionStatus(`Failed: ${data.error}`);
        setStatusError(true);
      }
    } catch (e) {
      setActionStatus(`Error: ${e.message}`);
      setStatusError(true);
    }
  };

  const doPrune = async () => {
    setActionStatus("Pruning dangling images...");
    setStatusError(false);
    setPruneResult(null);
    try {
      const res = await fetch("/plugins/signalk-container/api/prune", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        setPruneResult(data);
        setActionStatus(
          `Pruned ${data.imagesRemoved} image(s), reclaimed ${data.spaceReclaimed}.`,
        );
      } else {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        setActionStatus(`Prune failed: ${data.error}`);
        setStatusError(true);
      }
    } catch (e) {
      setActionStatus(`Error: ${e.message}`);
      setStatusError(true);
    }
  };

  return (
    <div style={S.root}>
      <div style={S.sectionTitle}>Runtime</div>

      {loading ? (
        <div style={S.empty}>Detecting container runtime...</div>
      ) : runtimeInfo ? (
        <div style={S.runtimeCard}>
          <div
            style={{
              ...S.runtimeIcon,
              background:
                runtimeInfo.runtime === "podman" ? "#892ca0" : "#2496ed",
              color: "#fff",
            }}
          >
            {runtimeInfo.runtime === "podman" ? "P" : "D"}
          </div>
          <div style={S.runtimeInfo}>
            <div style={S.runtimeName}>
              {runtimeInfo.runtime.charAt(0).toUpperCase() +
                runtimeInfo.runtime.slice(1)}
              {runtimeInfo.isPodmanDockerShim ? " (via docker shim)" : ""}
            </div>
            <div style={S.runtimeVersion}>Version {runtimeInfo.version}</div>
          </div>
          <div
            style={{
              ...S.stateIndicator,
              background: "#10b981",
            }}
            title="Runtime available"
          />
        </div>
      ) : (
        <div style={S.runtimeCard}>
          <div
            style={{
              ...S.runtimeIcon,
              background: "#fef2f2",
              color: "#ef4444",
            }}
          >
            !
          </div>
          <div style={S.runtimeInfo}>
            <div style={S.runtimeName}>No container runtime found</div>
            <div style={S.runtimeVersion}>
              Install Podman: sudo apt install podman
            </div>
          </div>
        </div>
      )}

      <div style={S.sectionTitle}>Settings</div>

      <SelectField
        label="Preferred runtime"
        value={runtime}
        onChange={setRuntime}
        options={[
          { value: "auto", label: "Auto-detect (Podman preferred)" },
          { value: "podman", label: "Podman" },
          { value: "docker", label: "Docker" },
        ]}
      />

      <SelectField
        label="Auto-prune images"
        value={pruneSchedule}
        onChange={setPruneSchedule}
        options={[
          { value: "off", label: "Off" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
        ]}
      />

      <SelectField
        label="Update check interval"
        value={updateCheckInterval}
        onChange={setUpdateCheckInterval}
        options={[
          { value: "1h", label: "Every hour" },
          { value: "6h", label: "Every 6 hours" },
          { value: "12h", label: "Every 12 hours" },
          { value: "24h", label: "Daily (recommended)" },
          { value: "48h", label: "Every 2 days" },
          { value: "168h", label: "Weekly" },
        ]}
        hint="How often to check for new container images"
      />

      <ToggleField
        label="Background update checks"
        value={backgroundUpdateChecks}
        onChange={setBackgroundUpdateChecks}
        hint="Disable on metered connections; manual check still works"
      />

      <div style={S.sectionTitle}>Managed Containers</div>

      {containers.length === 0 ? (
        <div style={S.empty}>
          {loading
            ? "Loading..."
            : "No managed containers. Other plugins will create them."}
        </div>
      ) : (
        containers.map((ct) => {
          const un = unprefixed(ct.name);
          const eff = effectiveLimits[un] || {};
          // Badge reads from the SERVER response (overrideStates),
          // not from the React containerOverrides state. This makes
          // it refresh-safe: the badge reflects what the backend
          // knows, which persists across browser reloads.
          const serverOverride = overrideStates[un];
          const hasOverride =
            serverOverride && Object.keys(serverOverride).length > 0;
          const isExpanded = expandedLimits.has(un);
          const badges = RESOURCE_FIELDS.map((f) =>
            formatLimitBadge(f.key, eff[f.key]),
          ).filter(Boolean);

          return (
            <div key={ct.name} style={S.containerCard}>
              <div style={S.containerItemFlat}>
                <div
                  style={{
                    ...S.stateIndicator,
                    background: stateColors[ct.state] || "#94a3b8",
                  }}
                  title={stateLabels[ct.state] || ct.state}
                />
                <div style={S.containerInfo}>
                  <div style={S.containerName}>{ct.name}</div>
                  <div style={S.containerMeta}>
                    {ct.image} &middot; {stateLabels[ct.state] || ct.state}
                    {ct.ports && ct.ports.length > 0 && ct.ports[0]
                      ? ` · ${ct.ports.join(", ")}`
                      : ""}
                  </div>
                </div>
                <div style={S.containerActions}>
                  {ct.state === "stopped" && (
                    <button
                      style={{
                        ...S.btn,
                        ...S.btnPrimary,
                        padding: "6px 12px",
                        fontSize: 12,
                      }}
                      onClick={() => startContainer(ct.name)}
                    >
                      Start
                    </button>
                  )}
                  {ct.state === "running" && (
                    <button
                      style={{ ...S.btn, ...S.btnWarning }}
                      onClick={() => stopContainer(ct.name)}
                    >
                      Stop
                    </button>
                  )}
                  <button
                    style={{ ...S.btn, ...S.btnDanger }}
                    onClick={() => removeContainer(ct.name, ct.state)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Badges row + Edit Limits toggle */}
              <div style={S.limitsRow}>
                {badges.length === 0 ? (
                  <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
                    No resource limits set
                  </span>
                ) : (
                  badges.map((b, i) => (
                    <span key={i} style={S.limitBadge}>
                      {b}
                    </span>
                  ))
                )}
                {hasOverride && (
                  <span
                    style={S.overrideBadge}
                    title="You have a user override configured for this container"
                  >
                    Override active
                  </span>
                )}
                {ct.state === "running" && (
                  <button
                    type="button"
                    style={S.editLimitsBtn}
                    onClick={() => toggleLimitsExpand(ct.name)}
                  >
                    {isExpanded ? "Collapse ▾" : "Edit Limits ▸"}
                  </button>
                )}
              </div>

              {isExpanded && (
                <ResourceLimitsEditor
                  containerName={un}
                  effective={eff}
                  initialOverride={serverOverride}
                  onApply={(payload) => applyLimits(un, payload)}
                  onClose={() => toggleLimitsExpand(ct.name)}
                />
              )}
            </div>
          );
        })
      )}

      <div style={S.sectionTitle}>Maintenance</div>

      <button style={{ ...S.btn, ...S.btnSuccess }} onClick={doPrune}>
        Prune Dangling Images
      </button>

      {actionStatus && (
        <div
          style={{
            ...S.status,
            color: statusError ? "#ef4444" : "#10b981",
          }}
        >
          {actionStatus}
        </div>
      )}

      <div style={{ ...S.sectionTitle, marginTop: 28 }}>&nbsp;</div>
      <button style={{ ...S.btn, ...S.btnSave }} onClick={doSave}>
        Save Configuration
      </button>
    </div>
  );
}
