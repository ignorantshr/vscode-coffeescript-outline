const vscode = require("vscode");
const crypto = require("crypto");

let symbolCache = new Map();
let enableCache = true;

function setEnableCache(value) {
  enableCache = value;
}

function calculateHash(content) {
  return crypto.createHash("md5").update(content).digest("hex");
}

function getFromCache(document) {
  if (!enableCache) {
    return null;
  }

  const currentContent = document.getText();
  const currentHash = calculateHash(currentContent);

  if (symbolCache.has(document.uri.toString())) {
    const cached = symbolCache.get(document.uri.toString());

    // 如果哈希值不同，则文件内容发生变化
    if (cached.hash === currentHash) {
      return cached.symbols;
    } else {
      return null;
    }
  } else {
    return null;
  }
}

function putToCache(document, symbols) {
  if (!enableCache) {
    return;
  }

  const currentContent = document.getText();
  const currentHash = calculateHash(currentContent);

  symbolCache.set(document.uri.toString(), {
    hash: currentHash,
    symbols: symbols,
  });
}

function clearCache() {
  symbolCache.clear();
}

module.exports = { setEnableCache, getFromCache, putToCache, clearCache };
