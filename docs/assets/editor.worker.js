import { SimpleWorkerServer, EditorSimpleWorker } from './chunk-B6R26HVS.js';
import './chunk-EIDCXKY6.js';
import './chunk-RJ4IHSSG.js';
import './chunk-SPOTY6QN.js';
import './chunk-KKWZTYBZ.js';

// demo/node_modules/vscode/vscode/src/vs/editor/editor.worker.js
var initialized = false;
function initialize(foreignModule) {
  if (initialized) {
    return;
  }
  initialized = true;
  const simpleWorker = new SimpleWorkerServer((msg) => {
    globalThis.postMessage(msg);
  }, (host) => new EditorSimpleWorker(host, foreignModule));
  globalThis.onmessage = (e) => {
    simpleWorker.onmessage(e.data);
  };
}
globalThis.onmessage = (e) => {
  if (!initialized) {
    initialize(null);
  }
};

export { initialize };
