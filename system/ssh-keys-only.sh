#!/bin/bash
# system/ssh-keys-only.sh -- the PC's SSH server takes keys only (I17, 8 Nov 2026; the Networking Handbook's chapter 6
# in one go). Run it ON THE PC, in its own terminal:
#
#     bash system/ssh-keys-only.sh             passwords off, no root, only you; then checked
#     bash system/ssh-keys-only.sh --home-only also: the keys in authorized_keys work only from the home network
#     bash system/ssh-keys-only.sh --undo      back to how it was (the settings file taken out)
#
# Safe by design: it stops before changing anything unless you have a key in ~/.ssh/authorized_keys (or you'd be
# locked out), it tests the settings (sshd -t) before using them and takes them back out if the test fails, and a
# reload keeps sessions already open. The settings go in their own file, /etc/ssh/sshd_config.d/10-cam.conf: files
# there are read first, and the first value read wins, so it beats Arch's defaults without touching sshd_config.
set -u
CONF_DIR="${SSHD_CONF_DIR:-/etc/ssh/sshd_config.d}"
CONF="$CONF_DIR/10-cam.conf"
KEYS="$HOME/.ssh/authorized_keys"
HOME_NET="${HOME_NET:-192.168.1.0/24}"
user="$(id -un)"

reload() {
  if systemctl is-active --quiet sshd; then sudo systemctl reload sshd && echo "  sshd reloaded (sessions already open stay open)"
  else echo "  sshd isn't running: the settings are used when it next starts"; fi
}

if [ "${1:-}" = "--undo" ]; then
  [ -f "$CONF" ] || { echo "Nothing to undo: $CONF isn't there."; exit 0; }
  sudo rm -f "$CONF" && echo "Took out $CONF (passwords are accepted again)." && reload
  exit 0
fi

echo "Keys only for the PC's SSH (Networking Handbook, chapter 6)"
n=$(grep -cE '^[^#]*(ssh-ed25519|ssh-rsa|ecdsa-sha2|sk-ssh)' "$KEYS" 2>/dev/null || true)
if [ "${n:-0}" -lt 1 ]; then
  echo "  STOPPED: there's no key in $KEYS, so turning passwords off would lock you out. Nothing was changed."
  exit 1
fi
echo "  $n key(s) can log in as $user"

sudo mkdir -p "$CONF_DIR"
sudo tee "$CONF" >/dev/null <<EOF
# Keys only (I17, 8 November 2026, system/ssh-keys-only.sh): no passwords, no root, only $user
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AllowUsers $user
X11Forwarding no
MaxAuthTries 3
EOF
if ! out=$(sudo sshd -t 2>&1); then
  sudo rm -f "$CONF"
  echo "  STOPPED: sshd found a problem with the settings, so they were taken back out. Nothing else changed:"
  printf '    %s\n' "$out"
  exit 1
fi
echo "  wrote $CONF (tested: no mistakes)"

if [ "${1:-}" = "--home-only" ]; then
  # from="..." in front of each key line that hasn't got one: a stolen key file is no use outside the home network
  cp "$KEYS" "$KEYS.before-home-only"
  awk -v net="$HOME_NET" '/^[^#]*(ssh-ed25519|ssh-rsa|ecdsa-sha2|sk-ssh)/ && $0 !~ /from="/ { $0 = "from=\"" net "\",no-agent-forwarding,no-X11-forwarding " $0 } { print }' \
    "$KEYS.before-home-only" > "$KEYS" && chmod 600 "$KEYS"
  echo "  keys limited to $HOME_NET (the old file is $KEYS.before-home-only)"
fi

reload
echo
echo "What the server uses now:"
sudo sshd -T 2>/dev/null | grep -E '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin|allowusers|maxauthtries) ' | sed 's/^/  /'
echo
echo "Now, from the laptop, in a NEW terminal (or ask Claude to check):"
echo "  ssh -i ~/.ssh/neuronet_mirror $user@<this PC> echo ok                    -> ok, with no password asked"
echo "  ssh -o PubkeyAuthentication=no $user@<this PC>                          -> Permission denied (publickey)"
echo "Something wrong? Sitting at the PC: bash system/ssh-keys-only.sh --undo"
