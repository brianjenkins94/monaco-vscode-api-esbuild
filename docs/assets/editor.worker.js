import { SimpleWorkerServer, EditorSimpleWorker, EditorWorkerHost } from './chunk-C3FLCM6T.js';
import './chunk-QPLMOWHB.js';
import './chunk-KKWZTYBZ.js';

// demo/node_modules/vscode/vscode/src/vs/editor/common/services/editorWorkerBootstrap.js
var initialized = false;
function initialize(factory) {
  if (initialized) {
    return;
  }
  initialized = true;
  const simpleWorker = new SimpleWorkerServer((msg) => {
    globalThis.postMessage(msg);
  }, (workerServer) => new EditorSimpleWorker(EditorWorkerHost.getChannel(workerServer), null));
  globalThis.onmessage = (e) => {
    simpleWorker.onmessage(e.data);
  };
}
globalThis.onmessage = (e) => {
  if (!initialized) {
    initialize();
  }
};
function bootstrapSimpleEditorWorker(createFn) {
  globalThis.onmessage = () => {
    initialize();
  };
}

export { bootstrapSimpleEditorWorker, initialize };
