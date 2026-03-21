# Hiddify VPN — Decky Plugin

Control [Hiddify VPN](https://github.com/hiddify/hiddify-app) from Game Mode on Steam Deck via the Quick Access Menu (`···` button).

Part of the [Hiddify Steam Deck port](https://github.com/denmrnngp-cloud/hiddify-steam-deck).

## Features

- **VPN ON / OFF** — one-tap toggle with colored status indicator
- **Profile selector** — switch between VPN configs without leaving Game Mode
- Connection status with TUN IP address
- Syncs with Hiddify GUI (stopping from plugin also stops GUI-managed VPN)
- Log viewer (last 40 lines)

## Requirements

1. [Decky Loader](https://decky.xyz/) installed
2. **Hiddify installed on the Steam Deck** via the installer:

```bash
# Download from: https://github.com/denmrnngp-cloud/hiddify-steam-deck/releases
bash ~/Downloads/Hiddify-linux-x64.bin
```

3. At least one VPN profile configured in the Hiddify GUI

## Install Plugin

```bash
sudo unzip -o decky-hiddify-v1.1.0.zip -d /home/deck/homebrew/plugins/
sudo systemctl restart plugin_loader
```

Or install via the **Decky Plugin Store** (search "Hiddify VPN").

## How It Works

- Backend (`main.py`): runs `HiddifyCli` as a subprocess, monitors `tun0` interface
- Frontend (`src/index.tsx`): React panel with VPN toggle and profile list
- Profile switching reads from `~/.local/share/app.hiddify.com/db.sqlite` and rebuilds `current-config.json`

## Supported Protocols

Via [sing-box](https://github.com/SagerNet/sing-box) core: **VLESS + Reality**, VMess, Trojan, Shadowsocks, Hysteria 2, TUIC, WireGuard

## Build from Source

```bash
npm install
npm run build
# dist/index.js is the compiled frontend
```

## License

MIT — see [LICENSE](LICENSE)
