// A tiny "bridge" so HTML buttons (outside the Canvas) can ask the 3D player
// to capture the mouse. The Player component fills in `lock` when it mounts.
// Pointer lock must be requested inside a click handler, which is why we call
// it directly instead of going through React state.
export const bridge = {
  lock: () => {},
  unlock: () => {},
}
