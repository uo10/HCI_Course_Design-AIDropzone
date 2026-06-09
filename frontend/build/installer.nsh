; NSIS hooks — electron-builder loads build/installer.nsh by default.
; Wipe per-user data on each install so reinstall does not inherit dev/test config.

!macro customInstall
  RMDir /r "$APPDATA\AI Dropzone"
!macroend
