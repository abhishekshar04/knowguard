/**
 * Jest environment for code that runs ONNX Runtime (the local embedding model).
 *
 * Jest executes tests in a separate VM context, so typed arrays created there are not the
 * constructors the native onnxruntime addon checks against ("A float32 tensor's data must be
 * type of Float32Array"). Exposing the host's constructors fixes that; nothing else changes.
 */
const { TestEnvironment } = require('jest-environment-node');

const SHARED = [
  'ArrayBuffer',
  'SharedArrayBuffer',
  'Float32Array',
  'Float64Array',
  'Int8Array',
  'Int16Array',
  'Int32Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Uint16Array',
  'Uint32Array',
  'BigInt64Array',
  'BigUint64Array',
];

class OnnxEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    for (const name of SHARED) this.global[name] = globalThis[name];
  }
}

module.exports = OnnxEnvironment;
