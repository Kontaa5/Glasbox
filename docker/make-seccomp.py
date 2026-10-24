"""Erzeugt seccomp-brave.json: Docker-Standardprofil + nur das, was Braves
Namespace-Sandbox braucht (clone/unshare/chroot in User-Namespaces).
chroot ausserhalb eines eigenen Namespaces bleibt trotzdem verboten, weil der
Container kein CAP_SYS_CHROOT hat (prueft der Kernel, nicht seccomp).
Aufruf: python3 -I docker/make-seccomp.py docker/seccomp-default.json docker/seccomp-brave.json"""
import json
import sys

src, dst = sys.argv[1], sys.argv[2]
profile = json.load(open(src))
profile["syscalls"].append({
    "names": ["clone", "unshare", "chroot"],
    "action": "SCMP_ACT_ALLOW",
    "comment": "securityBrowser: Chromium-Namespace-Sandbox",
})
json.dump(profile, open(dst, "w"), indent=1)
print("ok", dst)
