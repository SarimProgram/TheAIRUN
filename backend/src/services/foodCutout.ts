import { Worker } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Keep inference off Express's thread. One warm worker bounds model memory and
// avoids starting an ONNX session for every photo. Busy callers keep their photo.
let worker: Worker | undefined;
let busy = false;
const modulePath = require.resolve('@imgly/background-removal-node');
const assetsPath = pathToFileURL(path.dirname(modulePath) + path.sep).href;

export async function isolateFood(image: Buffer): Promise<Buffer | null> {
  if (busy) return null;
  busy = true;
  return new Promise((resolve) => {
    let settled = false;
    let currentWorker: Worker | undefined;
    const onFailure = () => finish(null, true);
    const onMessage = (result: { png: Uint8Array | null }) => finish(result.png ? Buffer.from(result.png) : null, !result.png);
    const finish = (result: Buffer | null, reset = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      currentWorker?.removeListener('message', onMessage);
      currentWorker?.removeListener('error', onFailure);
      currentWorker?.removeListener('exit', onFailure);
      if (reset && currentWorker) {
        void currentWorker.terminate();
        if (worker === currentWorker) worker = undefined;
      }
      busy = false;
      resolve(result);
    };
    const timeout = setTimeout(() => finish(null, true), 15_000);
    try {
      if (!worker) {
        worker = new Worker(`
          const { parentPort, workerData } = require('node:worker_threads');
          const { removeBackground } = require(workerData.modulePath);
          parentPort.on('message', async (bytes) => {
            try {
              const png = await removeBackground(new Blob([bytes], { type: 'image/jpeg' }), {
                model: 'medium', publicPath: workerData.assetsPath,
                output: { format: 'image/png' },
              });
              parentPort.postMessage({ png: new Uint8Array(await png.arrayBuffer()) });
            } catch { parentPort.postMessage({ png: null }); }
          });
        `, { eval: true, workerData: { modulePath, assetsPath } });
        const created = worker;
        // An idle worker can fail, too. Keep an error listener after each job.
        const clearDeadWorker = () => { if (worker === created) worker = undefined; };
        created.on('error', clearDeadWorker);
        created.on('exit', clearDeadWorker);
        worker.unref();
      }
      currentWorker = worker;
      currentWorker.once('message', onMessage);
      currentWorker.once('error', onFailure);
      currentWorker.once('exit', onFailure);
      currentWorker.postMessage(image);
    } catch {
      finish(null, true);
    }
  });
}
