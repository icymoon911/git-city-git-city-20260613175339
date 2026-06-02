// ─── Silence the THREE.Clock deprecation spam ──────────────────────────────
// Three.js r183 deprecated `THREE.Clock` and warns inside its constructor.
// @react-three/fiber@9 still does `new THREE.Clock()` once per <Canvas> mount,
// so the console gets flooded on every mount / HMR reload. (Note: three's own
// warn() double-prefixes, so the message actually reads "THREE.THREE.Clock: …".)
//
// We use three's official `setConsoleFunction` hook (the maintainer-endorsed
// interim shim, pmndrs/react-three-fiber#2688) so this is scoped to three.js
// logging only — it never touches the app's global console. Every other three.js
// message is forwarded untouched, so real warnings/errors (e.g. shader compile
// failures) still surface.
//
// This is a side-effect-only module: import it (`import "@/lib/silenceThreeClockWarning"`)
// at the top of each <Canvas>-owning component. It must live in the 3D code path
// rather than the root layout, otherwise three.js gets pulled out of its lazy
// dynamic-import chunk and into every route's bundle.
//
// REMOVE once we upgrade to @react-three/fiber v10 (migrated to THREE.Timer).
import { setConsoleFunction } from "three";

setConsoleFunction((method, ...args) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("Clock: This module has been deprecated")
  ) {
    return;
  }
  const forward = (console as unknown as Record<string, typeof console.log>)[method];
  (typeof forward === "function" ? forward : console.log)(...args);
});
