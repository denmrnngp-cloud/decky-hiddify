const manifest = {"name":"Hiddify VPN","author":"denmrnngp-cloud","flags":[],"api_version":2,"version":"1.2.0","publish":{"tags":["vpn","network","hiddify","proxy","sing-box"],"description":"Control Hiddify VPN from Game Mode. Toggle VPN on/off, switch profiles, view connection status. Requires Hiddify installed via the installer — see github.com/denmrnngp-cloud/hiddify-steam-deck","image":"https://raw.githubusercontent.com/denmrnngp-cloud/decky-hiddify/main/assets/store.png"}};
const API_VERSION = 2;
const internalAPIConnection = window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;
if (!internalAPIConnection) {
    throw new Error('[@decky/api]: Failed to connect to the loader as as the loader API was not initialized. This is likely a bug in Decky Loader.');
}
let api;
try {
    api = internalAPIConnection.connect(API_VERSION, manifest.name);
}
catch {
    api = internalAPIConnection.connect(1, manifest.name);
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version 1. Some features may not work.`);
}
if (api._version != API_VERSION) {
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version ${api._version}. Some features may not work.`);
}
const callable = api.callable;
const addEventListener = api.addEventListener;
const removeEventListener = api.removeEventListener;
const toaster = api.toaster;
const definePlugin = (fn) => {
    return (...args) => {
        return fn(...args);
    };
};

// ── Error boundary ──────────────────────────────────────────────────────────
class ErrBoundary extends SP_REACT.Component {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { err: null }
        });
    }
    static getDerivedStateFromError(e) { return { err: String(e) }; }
    render() {
        if (this.state.err) {
            return (SP_REACT.createElement(DFL.PanelSection, null,
                SP_REACT.createElement(DFL.PanelSectionRow, null,
                    SP_REACT.createElement("div", { style: { fontSize: 11, color: "#f87171", padding: 8 } },
                        "\u26A0 Render error:",
                        SP_REACT.createElement("br", null),
                        this.state.err))));
        }
        return this.props.children;
    }
}
// ── Icons ───────────────────────────────────────────────────────────────────
const ShieldIcon = ({ color = "currentColor" }) => (SP_REACT.createElement("svg", { viewBox: "0 0 24 24", width: "1em", height: "1em", fill: color },
    SP_REACT.createElement("path", { d: "M12 2L4 5v6c0 5.25 3.4 10.15 8 11.38C16.6 21.15 20 16.25 20 11V5L12 2z" })));
// ── Callables ───────────────────────────────────────────────────────────────
const getStatus = callable("get_status");
const startVpn = callable("start_vpn");
const stopVpn = callable("stop_vpn");
const getInstallStatus = callable("get_install_status");
const repair = callable("repair");
const getLogs = callable("get_logs");
const getProfiles = callable("get_profiles");
const switchProfile = callable("switch_profile");
// ── VPN panel ───────────────────────────────────────────────────────────────
function VpnPanel() {
    const [status, setStatus] = SP_REACT.useState({
        connected: false, running: false, vpn_ip: "", install_state: "ready", active_profile: "",
    });
    const [loading, setLoading] = SP_REACT.useState(false);
    const [profiles, setProfiles] = SP_REACT.useState([]);
    const [switching, setSwitching] = SP_REACT.useState(false);
    const [showLogs, setShowLogs] = SP_REACT.useState(false);
    const [logs, setLogs] = SP_REACT.useState("");
    const fetchStatus = async () => {
        try {
            setStatus(await getStatus());
        }
        catch { }
    };
    const fetchProfiles = async () => {
        try {
            setProfiles(await getProfiles());
        }
        catch { }
    };
    SP_REACT.useEffect(() => {
        fetchStatus();
        fetchProfiles();
        const listener = addEventListener("vpn_status_changed", (s) => {
            if (s.dropped) {
                toaster.toast({ title: "Hiddify VPN", body: "VPN disconnected — tap to reconnect", duration: 5000 });
            }
            setStatus(prev => ({ ...prev, ...s }));
        });
        const iv = setInterval(fetchStatus, 5000);
        return () => { removeEventListener("vpn_status_changed", listener); clearInterval(iv); };
    }, []);
    const handleToggle = async () => {
        if (loading)
            return;
        setLoading(true);
        const wasOn = status.connected;
        try {
            const result = wasOn ? await stopVpn() : await startVpn();
            if (!result.success) {
                toaster.toast({ title: "VPN Error", body: result.message, duration: 5000 });
                await fetchStatus();
                return;
            }
            for (let i = 0; i < 18; i++) {
                await new Promise(r => setTimeout(r, 1000));
                await fetchStatus();
                const s = await getStatus();
                setStatus(s);
                if (!wasOn && s.connected)
                    break;
                if (wasOn && !s.connected && !s.running)
                    break;
            }
            const final = await getStatus();
            setStatus(final);
            toaster.toast({ title: "Hiddify VPN", body: final.connected ? "VPN ON" : "VPN OFF", duration: 3000 });
        }
        catch (e) {
            toaster.toast({ title: "Error", body: String(e), duration: 5000 });
            await fetchStatus();
        }
        finally {
            setLoading(false);
        }
    };
    const handleSwitch = async (id) => {
        setSwitching(true);
        try {
            const r = await switchProfile(id);
            if (r.success) {
                await fetchProfiles();
                await fetchStatus();
                toaster.toast({ title: "Hiddify VPN", body: r.message, duration: 3000 });
            }
            else {
                toaster.toast({ title: "Profile Error", body: r.message, duration: 5000 });
            }
        }
        catch (e) {
            toaster.toast({ title: "Error", body: String(e), duration: 5000 });
        }
        finally {
            setSwitching(false);
        }
    };
    const isOn = status.connected;
    // Status dot color
    const dotColor = status.connected ? "#4ade80" : status.running ? "#facc15" : "#f87171";
    const statusText = loading
        ? (isOn ? "Disconnecting…" : "Connecting…")
        : status.connected
            ? (status.vpn_ip ? `Connected · ${status.vpn_ip}` : "Connected")
            : status.running ? "Connecting…" : "Disconnected";
    return (SP_REACT.createElement("div", null,
        SP_REACT.createElement(DFL.PanelSection, null,
            SP_REACT.createElement(DFL.PanelSectionRow, null,
                SP_REACT.createElement(DFL.ButtonItem, { onClick: handleToggle, disabled: loading, layout: "below" },
                    SP_REACT.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, width: "100%" } },
                        SP_REACT.createElement("div", { style: {
                                width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                                background: dotColor, boxShadow: `0 0 6px ${dotColor}`,
                            } }),
                        SP_REACT.createElement("div", { style: { flex: 1 } },
                            SP_REACT.createElement("div", { style: { fontSize: 14, fontWeight: "bold", color: dotColor } }, isOn ? "VPN ON" : "VPN OFF"),
                            SP_REACT.createElement("div", { style: { fontSize: 11, opacity: 0.7 } }, statusText)),
                        loading && SP_REACT.createElement(DFL.Spinner, { style: { width: 16, height: 16 } })))),
            profiles.length > 1 && (SP_REACT.createElement(DFL.PanelSectionRow, null,
                SP_REACT.createElement("div", { style: { width: "100%", paddingTop: 4 } },
                    SP_REACT.createElement("div", { style: { fontSize: 11, opacity: 0.5, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" } }, isOn ? "Stop VPN to change profile" : "Profile"),
                    profiles.map(p => (SP_REACT.createElement(DFL.ButtonItem, { key: p.id, onClick: () => !isOn && !switching && !p.active && handleSwitch(p.id), disabled: isOn || switching || p.active },
                        SP_REACT.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                            SP_REACT.createElement("div", { style: {
                                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                                    background: p.active ? "#4ade80" : "rgba(255,255,255,0.25)",
                                } }),
                            SP_REACT.createElement("span", { style: { flex: 1 } }, p.name),
                            p.active && (SP_REACT.createElement("span", { style: { fontSize: 10, color: "#4ade80" } }, "active")))))))))),
        SP_REACT.createElement(DFL.PanelSection, { title: "Tools" },
            SP_REACT.createElement(DFL.PanelSectionRow, null,
                SP_REACT.createElement(DFL.ButtonItem, { onClick: async () => {
                        try {
                            setLogs(await getLogs());
                        }
                        catch (e) {
                            setLogs(`Error: ${e}`);
                        }
                        setShowLogs(v => !v);
                    } }, showLogs ? "Hide logs" : "Show logs")),
            showLogs && (SP_REACT.createElement(DFL.PanelSectionRow, null,
                SP_REACT.createElement("div", { style: {
                        fontSize: 10, fontFamily: "monospace", whiteSpace: "pre-wrap",
                        wordBreak: "break-all", maxHeight: 180, overflowY: "auto",
                        background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 4,
                    } }, logs || "No logs"))))));
}
// ── Install / repair panel ──────────────────────────────────────────────────
function InstallPanel({ state, message, onDone }) {
    const [loading, setLoading] = SP_REACT.useState(false);
    const handleRepair = async () => {
        setLoading(true);
        try {
            const r = await repair();
            toaster.toast({ title: "Hiddify", body: r.message, duration: 3000 });
            if (r.success)
                onDone();
        }
        catch (e) {
            toaster.toast({ title: "Error", body: String(e), duration: 5000 });
        }
        setLoading(false);
    };
    return (SP_REACT.createElement(DFL.PanelSection, null,
        SP_REACT.createElement(DFL.PanelSectionRow, null,
            SP_REACT.createElement("div", { style: { fontSize: 13, color: "#facc15", fontWeight: "bold", marginBottom: 6 } }, state === "needs_repair" ? "⚠ Repair required" : "🔧 Not installed")),
        SP_REACT.createElement(DFL.PanelSectionRow, null,
            SP_REACT.createElement("div", { style: { fontSize: 12, opacity: 0.8 } }, message)),
        state === "not_installed" && (SP_REACT.createElement(DFL.PanelSectionRow, null,
            SP_REACT.createElement("div", { style: { fontSize: 11, opacity: 0.6, lineHeight: 1.8 } },
                "Open Konsole and run:",
                SP_REACT.createElement("br", null),
                SP_REACT.createElement("code", { style: { fontSize: 10, background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 2 } }, "bash ~/Downloads/Hiddify-linux-x64.bin")))),
        state === "needs_repair" && (SP_REACT.createElement(DFL.PanelSectionRow, null, loading
            ? SP_REACT.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                SP_REACT.createElement(DFL.Spinner, null),
                SP_REACT.createElement("span", null, "Repairing\u2026"))
            : SP_REACT.createElement(DFL.ButtonItem, { onClick: handleRepair }, "\uD83D\uDD27 Repair")))));
}
// ── Root ────────────────────────────────────────────────────────────────────
function Content() {
    const [installState, setInstallState] = SP_REACT.useState(null);
    const [installMsg, setInstallMsg] = SP_REACT.useState("");
    const [checking, setChecking] = SP_REACT.useState(true);
    const [fetchError, setFetchError] = SP_REACT.useState(null);
    const check = async () => {
        setChecking(true);
        setFetchError(null);
        try {
            const s = await getInstallStatus();
            setInstallState(s.state);
            setInstallMsg(s.message);
        }
        catch (e) {
            setFetchError(String(e));
        }
        setChecking(false);
    };
    SP_REACT.useEffect(() => { check(); }, []);
    if (checking) {
        return (SP_REACT.createElement(DFL.PanelSection, null,
            SP_REACT.createElement(DFL.PanelSectionRow, null,
                SP_REACT.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: 8 } },
                    SP_REACT.createElement(DFL.Spinner, null),
                    SP_REACT.createElement("span", { style: { fontSize: 12 } }, "Checking\u2026")))));
    }
    if (fetchError) {
        return (SP_REACT.createElement(DFL.PanelSection, null,
            SP_REACT.createElement(DFL.PanelSectionRow, null,
                SP_REACT.createElement("div", { style: { fontSize: 11, color: "#f87171", padding: 8, lineHeight: 1.5 } },
                    "\u26A0 Backend error:",
                    SP_REACT.createElement("br", null),
                    fetchError)),
            SP_REACT.createElement(DFL.PanelSectionRow, null,
                SP_REACT.createElement(DFL.ButtonItem, { onClick: check }, "Retry"))));
    }
    if (installState === "ready")
        return SP_REACT.createElement(VpnPanel, null);
    return (SP_REACT.createElement(InstallPanel, { state: installState ?? "not_installed", message: installMsg, onDone: check }));
}
var index = definePlugin(() => ({
    name: "Hiddify VPN",
    title: (SP_REACT.createElement("div", { className: DFL.staticClasses.Title, style: { display: "flex", alignItems: "center", gap: 8 } },
        SP_REACT.createElement(ShieldIcon, { color: "#4ade80" }),
        "Hiddify VPN")),
    content: (SP_REACT.createElement(ErrBoundary, null,
        SP_REACT.createElement(Content, null))),
    icon: SP_REACT.createElement(ShieldIcon, null),
    onDismount() { },
}));

export { index as default };
//# sourceMappingURL=index.js.map
