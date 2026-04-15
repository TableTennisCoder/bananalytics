let _isDemoMode = false;

export function setDemoMode(v: boolean) {
  _isDemoMode = v;
}

export function isDemoMode() {
  return _isDemoMode;
}
