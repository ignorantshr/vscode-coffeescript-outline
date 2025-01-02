const vscode = require("vscode");
const coffee = require("coffeescript");
const {
  setEnableCache,
  getFromCache,
  putToCache,
  clearCache,
} = require("./cache");

class CoffeeScriptDocumentSymbolProvider {
  constructor() {
    let enabled = vscode.workspace
      .getConfiguration("coffeeOutline")
      .get("enableCache");
    setEnableCache(enabled);
  }

  toggleCache(enabled) {
    setEnableCache(enabled);
    if (!enabled) {
      clearCache();
    }
    vscode.window.showInformationMessage(
      `CoffeeScript Outline cache ${enabled ? "enabled" : "disabled"}`
    );
  }

  provideDocumentSymbols(document, token) {
    return new Promise((resolve) => {
      let cached = getFromCache(document);
      if (cached) {
        resolve(cached);
        return;
      }

      const text = document.getText();
      const symbols = [];

      try {
        const ast = coffee.nodes(text);
        console.log(ast);
        this.parseNode(ast, symbols, document);
      } catch (error) {
        console.error("Coffeescript Outline parse error:", error);
      }

      putToCache(document, symbols);
      resolve(symbols);
    });
  }

  parseNode(node, symbols, document, parent = null) {
    if (!node) return;

    // 根据节点类型处理
    switch (node.constructor.name) {
      case "Root":
        if (node.body) {
          this.parseNode(node.body, symbols, document, parent);
        }
        break;

      case "Class":
        const classSymbol = new vscode.DocumentSymbol(
          node.variable.base.value,
          "",
          vscode.SymbolKind.Class,
          this.getRange(node, document),
          this.getRange(node.variable, document)
        );
        if (parent) {
          parent.children.push(classSymbol);
        } else {
          symbols.push(classSymbol);
        }
        // 解析类的内部节点
        if (node.body) {
          this.parseNode(node.body, symbols, document, classSymbol);
        }
        break;

      case "Block":
        node.expressions?.forEach((expr) => {
          this.parseNode(expr, symbols, document, parent);
        });
        break;

      case "Value": // expression
        if (node.base?.objects) {
          node.base.objects.forEach((obj) => {
            this.parseNode(obj, symbols, document, parent);
          });
        }
        break;

      case "Assign":
        if (node.context === "object") {
          // 方法
          let method = node.variable.base.value;
          if (node.variable.this) {
            method = "@" + node.variable.properties[0].name.value;
          }
          const methodSymbol = new vscode.DocumentSymbol(
            method,
            "",
            vscode.SymbolKind.Method,
            this.getRange(node, document),
            this.getRange(node.variable, document)
          );
          if (parent) {
            parent.children.push(methodSymbol);
          } else {
            symbols.push(methodSymbol);
          }
          // 解析方法内部节点
          if (node.value.body) {
            this.parseNode(node.value.body, symbols, document, methodSymbol);
          }
        } else {
          // 变量
          let name = node.variable.base.value;
          if (node.variable.this) {
            name = "@";
          }

          for (let property of node.variable.properties) {
            switch (property.constructor.name) {
              case "Access":
                if (name === "@") {
                  name += property.name.value;
                } else {
                  name += "." + property.name.value;
                }
                break;

              case "Index":
                let base = "[" + property.index.base.value;
                for (let access of property.index.properties) {
                  if (access.constructor.name === "Access") {
                    base += "." + access.name.value;
                  }
                }
                base += "]";
                name += base;
                break;

              default:
                break;
            }
          }

          const propertySymbol = new vscode.DocumentSymbol(
            name,
            "",
            vscode.SymbolKind.Variable,
            this.getRange(node, document),
            this.getRange(node.variable, document)
          );
          if (parent) {
            parent.children.push(propertySymbol);
          } else {
            symbols.push(propertySymbol);
          }
        }
        break;
    }
  }

  getRange(node, document) {
    const start = this.getPosition(
      node.locationData.first_line,
      node.locationData.first_column,
      document
    );
    const end = this.getPosition(
      node.locationData.last_line,
      node.locationData.last_column + 1,
      document
    );
    return new vscode.Range(start, end);
  }

  getPosition(line, column) {
    return new vscode.Position(line, column);
  }
}

function activate(context) {
  const provider = new CoffeeScriptDocumentSymbolProvider();

  // 注册 outline 提供者
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      { scheme: "file", language: "coffeescript" },
      provider
    )
  );

  // 监听配置变化
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("coffeeOutline.enableCache")) {
        provider.toggleCache(
          vscode.workspace.getConfiguration("coffeeOutline").get("enableCache")
        );
      }
    })
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
