// Stub for Node built-ins (`node:fs/promises`, `node:os`, `node:path`,
// `node:child_process`) when bundling for React Native. These imports live
// behind `isNode()` runtime guards in dev/tooling code paths, but Metro can't
// tree-shake based on runtime conditions, so we shim them to no-ops here.
const reject = () => Promise.reject(new Error('node built-in not available on react-native'));
module.exports = new Proxy(
  {},
  {
    get() {
      return reject;
    },
  },
);
