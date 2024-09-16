import { IExtHostExtensionService, ExtHostExtensionService, IExtensionStoragePaths, ExtensionStoragePaths, ExtensionHostMain } from './chunk-O3MBOO3C.js';
import { registerSingleton, InstantiationType, mark, VSBuffer, isMessageOfType, MessageType, createMessageOfType } from './chunk-HYPTIEB4.js';
import { URI, basename, Emitter } from './chunk-QPLMOWHB.js';
import './chunk-KKWZTYBZ.js';

// demo/node_modules/vscode/vscode/src/vs/workbench/services/extensions/worker/polyfillNestedWorker.js
var _bootstrapFnSource = function _bootstrapFn(workerUrl) {
  const listener = (event) => {
    globalThis.removeEventListener("message", listener);
    const port = event.data;
    Object.defineProperties(globalThis, {
      "postMessage": {
        value(data, transferOrOptions) {
          port.postMessage(data, transferOrOptions);
        }
      },
      "onmessage": {
        get() {
          return port.onmessage;
        },
        set(value) {
          port.onmessage = value;
        }
      }
    });
    port.addEventListener("message", (msg) => {
      globalThis.dispatchEvent(new MessageEvent(
        "message",
        { data: msg.data, ports: msg.ports ? [...msg.ports] : void 0 }
      ));
    });
    port.start();
    globalThis.Worker = class {
      constructor() {
        throw new TypeError("Nested workers from within nested worker are NOT supported.");
      }
    };
    importScripts(workerUrl);
  };
  globalThis.addEventListener("message", listener);
}.toString();
var NestedWorker = class extends EventTarget {
  constructor(nativePostMessage2, stringOrUrl, options) {
    super();
    this.onmessage = null;
    this.onmessageerror = null;
    this.onerror = null;
    const bootstrap = `((${_bootstrapFnSource})('${stringOrUrl}'))`;
    const blob = new Blob([bootstrap], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    const channel = new MessageChannel();
    const id = blobUrl;
    const msg = {
      type: "_newWorker",
      id,
      port: channel.port2,
      url: blobUrl,
      options
    };
    nativePostMessage2(msg, [channel.port2]);
    this.postMessage = channel.port1.postMessage.bind(channel.port1);
    this.terminate = () => {
      const msg2 = {
        type: "_terminateWorker",
        id
      };
      nativePostMessage2(msg2);
      URL.revokeObjectURL(blobUrl);
      channel.port1.close();
      channel.port2.close();
    };
    Object.defineProperties(this, {
      "onmessage": {
        get() {
          return channel.port1.onmessage;
        },
        set(value) {
          channel.port1.onmessage = value;
        }
      },
      "onmessageerror": {
        get() {
          return channel.port1.onmessageerror;
        },
        set(value) {
          channel.port1.onmessageerror = value;
        }
      }
    });
    channel.port1.addEventListener("messageerror", (evt) => {
      const msgEvent = new MessageEvent("messageerror", { data: evt.data });
      this.dispatchEvent(msgEvent);
    });
    channel.port1.addEventListener("message", (evt) => {
      const msgEvent = new MessageEvent("message", { data: evt.data });
      this.dispatchEvent(msgEvent);
    });
    channel.port1.start();
  }
};

// demo/node_modules/vscode/vscode/src/vs/workbench/api/worker/extHost.worker.services.js
registerSingleton(IExtHostExtensionService, ExtHostExtensionService, InstantiationType.Eager);
registerSingleton(IExtensionStoragePaths, ExtensionStoragePaths, InstantiationType.Eager);

// demo/node_modules/vscode/vscode/src/vs/workbench/api/worker/extensionHostWorker.js
var nativeClose = self.close.bind(self);
self.close = () => console.trace(`'close' has been blocked`);
var nativePostMessage = postMessage.bind(self);
self.postMessage = () => console.trace(`'postMessage' has been blocked`);
function shouldTransformUri(uri) {
  return /^(file|extension-file|vscode-remote):/i.test(uri);
}
var nativeFetch = fetch.bind(self);
function patchFetching(asBrowserUri) {
  self.fetch = async function(input, init) {
    if (input instanceof Request) {
      return nativeFetch(input, init);
    }
    if (shouldTransformUri(String(input))) {
      input = (await asBrowserUri(URI.parse(String(input)))).toString(true);
    }
    return nativeFetch(input, init);
  };
  self.XMLHttpRequest = class extends XMLHttpRequest {
    open(method, url, async, username, password) {
      (async () => {
        if (shouldTransformUri(url.toString())) {
          url = (await asBrowserUri(URI.parse(url.toString()))).toString(true);
        }
        super.open(method, url, async ?? true, username, password);
      })();
    }
  };
}
self.importScripts = () => {
  throw new Error(`'importScripts' has been blocked`);
};
self.addEventListener = () => console.trace(`'addEventListener' has been blocked`);
self["AMDLoader"] = void 0;
self["NLSLoaderPlugin"] = void 0;
self["define"] = void 0;
self["require"] = void 0;
self["webkitRequestFileSystem"] = void 0;
self["webkitRequestFileSystemSync"] = void 0;
self["webkitResolveLocalFileSystemSyncURL"] = void 0;
self["webkitResolveLocalFileSystemURL"] = void 0;
function patchWorker(asBrowserUri, getAllStaticBrowserUris) {
  if (self.Worker) {
    const _Worker = self.Worker;
    Worker = function(stringUrl, options) {
      if (/^vscode-remote:/i.test(stringUrl.toString())) {
        throw new Error(`Creating workers from remote extensions is currently not supported.`);
      }
      async function getWorkerUri(workerUri) {
        const [browserUrl, staticBrowserUrls] = await Promise.all([
          asBrowserUri(workerUri).then((uri) => uri.toString(true)),
          getAllStaticBrowserUris().then((bindings) => Object.fromEntries(bindings.map(([from, to]) => [from.toString(true), to.toString(true)])))
        ]);
        const bootstrapFnSource = function bootstrapFn(workerUrl, staticBrowserUrls2) {
          function asWorkerBrowserUrl(url) {
            if (typeof url === "string" || url instanceof URL) {
              url = String(url).replace(/^file:\/\//i, "vscode-file://vscode-app");
              return staticBrowserUrls2[url] ?? url;
            }
            return url;
          }
          const nativeFetch2 = fetch.bind(self);
          self.fetch = function(input, init) {
            if (input instanceof Request) {
              return nativeFetch2(input, init);
            }
            return nativeFetch2(asWorkerBrowserUrl(input), init);
          };
          self.XMLHttpRequest = class extends XMLHttpRequest {
            constructor() {
              super(...arguments);
              this.notFound = false;
            }
            open(method, url, async, username, password) {
              const transformedUrl = asWorkerBrowserUrl(url);
              this.notFound = transformedUrl.startsWith("extension-file:");
              return super.open(method, transformedUrl, async ?? true, username, password);
            }
            send(body) {
              if (this.notFound) {
                return;
              }
              super.send(body);
            }
            get status() {
              return this.notFound ? 404 : super.status;
            }
          };
          const nativeImportScripts = importScripts.bind(self);
          self.importScripts = (...urls) => {
            nativeImportScripts(...urls.map(asWorkerBrowserUrl));
          };
          self.importExt = (url) => {
            return new Function("url", "return import(url)")(asWorkerBrowserUrl(url));
          };
          nativeImportScripts(workerUrl);
        }.toString();
        const js = `(${bootstrapFnSource}('${browserUrl}', ${JSON.stringify(staticBrowserUrls)}))`;
        const blob = new Blob([js], { type: "application/javascript" });
        return URL.createObjectURL(blob);
      }
      options = options || {};
      options.name = `${name} -> ${options.name || basename(stringUrl.toString())}`;
      class ExtensionWorker2 {
        constructor(scriptURL, options2) {
          this._onmessage = null;
          this._onmessageerror = null;
          this._onerror = null;
          this.workerPromise = getWorkerUri(URI.parse(scriptURL instanceof URL ? scriptURL.toString() : scriptURL)).then((url) => {
            return new _Worker(url, options2);
          });
        }
        set onmessage(cb) {
          this._onmessage = cb;
          this.workerPromise.then((worker) => {
            worker.onmessage = cb;
          }, console.error);
        }
        get onmessage() {
          return this._onmessage;
        }
        set onmessageerror(cb) {
          this._onmessageerror = cb;
          this.workerPromise.then((worker) => {
            worker.onmessageerror = cb;
          }, console.error);
        }
        get onmessageerror() {
          return this._onmessageerror;
        }
        set onerror(cb) {
          this._onerror = cb;
          this.workerPromise.then((worker) => {
            worker.onerror = cb;
          }, console.error);
        }
        get onerror() {
          return this._onerror;
        }
        postMessage(message, options2) {
          this.workerPromise.then((worker) => {
            worker.postMessage(message, options2);
          }, console.error);
        }
        terminate() {
          this.workerPromise.then((worker) => {
            worker.terminate();
          }, console.error);
        }
        addEventListener(type, listener, options2) {
          this.workerPromise.then((worker) => {
            worker.addEventListener(type, listener, options2);
          }, console.error);
        }
        removeEventListener(type, listener, options2) {
          this.workerPromise.then((worker) => {
            worker.removeEventListener(type, listener, options2);
          }, console.error);
        }
        dispatchEvent(event) {
          this.workerPromise.then((worker) => {
            worker.dispatchEvent(event);
          }, console.error);
          return false;
        }
      }
      return new ExtensionWorker2(stringUrl, options);
    };
  } else {
    self.Worker = class extends NestedWorker {
      constructor(stringOrUrl, options) {
        super(nativePostMessage, stringOrUrl, { name: basename(stringOrUrl.toString()), ...options });
      }
    };
  }
}
var hostUtil = new class {
  constructor() {
    this.pid = void 0;
  }
  exit(_code) {
    nativeClose();
  }
}();
var ExtensionWorker = class {
  constructor() {
    const channel = new MessageChannel();
    const emitter = new Emitter();
    let terminating = false;
    nativePostMessage(channel.port2, [channel.port2]);
    channel.port1.onmessage = (event) => {
      const { data } = event;
      if (!(data instanceof ArrayBuffer)) {
        console.warn("UNKNOWN data received", data);
        return;
      }
      const msg = VSBuffer.wrap(new Uint8Array(data, 0, data.byteLength));
      if (isMessageOfType(msg, MessageType.Terminate)) {
        terminating = true;
        onTerminate("received terminate message from renderer");
        return;
      }
      emitter.fire(msg);
    };
    this.protocol = {
      onMessage: emitter.event,
      send: (vsbuf) => {
        if (!terminating) {
          const data = vsbuf.buffer.buffer.slice(vsbuf.buffer.byteOffset, vsbuf.buffer.byteOffset + vsbuf.buffer.byteLength);
          channel.port1.postMessage(data, [data]);
        }
      }
    };
  }
};
function connectToRenderer(protocol) {
  return new Promise((resolve) => {
    const once = protocol.onMessage((raw) => {
      once.dispose();
      const initData = JSON.parse(raw.toString());
      protocol.send(createMessageOfType(MessageType.Initialized));
      resolve({ protocol, initData });
    });
    protocol.send(createMessageOfType(MessageType.Ready));
  });
}
var onTerminate = (reason) => nativeClose();
function isInitMessage(a) {
  return !!a && typeof a === "object" && a.type === "vscode.init" && a.data instanceof Map;
}
function create() {
  mark(`code/extHost/willConnectToRenderer`);
  const res = new ExtensionWorker();
  return {
    onmessage(message) {
      if (!isInitMessage(message)) {
        return;
      }
      connectToRenderer(res.protocol).then((data) => {
        mark(`code/extHost/didWaitForInitData`);
        const extHostMain = new ExtensionHostMain(data.protocol, data.initData, hostUtil, null, message.data);
        patchFetching((uri) => extHostMain.asBrowserUri(uri));
        patchWorker((uri) => extHostMain.asBrowserUri(uri), () => extHostMain.getAllStaticBrowserUris());
        onTerminate = (reason) => extHostMain.terminate(reason);
      });
    }
  };
}

export { create };
