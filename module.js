const esprima = require('esprima');
const escodegen = require('escodegen');
const fs = require('fs');
const Scope = require('./scope');

module.exports = class Module {
  // name in direction
  constructor(directory, name) {
    this.name = name;
    this.directory = directory;
    const path = `${directory}/${name}.js`
    const codeBuffer = fs.readFileSync(path);
    const ast = esprima.parseModule(codeBuffer.toString());

    this.exportNameSet = new Set(); // not include export default
    this.defaultExport = '';

    // module graph
    this.connectedModules = [];
    this.rootScope = new Scope(ast, null, this.handlePart);
  }

  // part is file top-statement
  handlePart = (part) => {
    const { type } = part;
    let defaultExport = null;
    const importedInfo = [];
    if (type === 'ImportDeclaration') {
      const { specifiers } = part;
      specifiers.forEach(spec => {
        if (spec.type === 'ImportDefaultSpecifier') {
          defaultExport = part.local.name;
        } else {
          const nameInfo = {
            imported: spec.imported.name,
            local: spec.local.name,
          }
          importedInfo.push(nameInfo);
        }
      });
      const moduleInfo = {
        path: part.source.value,
        importedInfo,
        defaultExport,
      }
      this.connectedModules.push(moduleInfo);
    } else if (type === 'ExportNamedDeclaration') {
      const { declaration} = part;
      if (declaration.type === 'FunctionDeclaration') {
        this.exportNameSet.add(declaration.id.name)
      }
      if (declaration.type === 'VariableDeclaration') {
        const { declarations } = declaration;
        declarations.forEach(decl => {
          this.exportNameSet.add(decl.id.name);
        })
      }
    } else if (type === 'ExportDefaultDeclaration') {
      this.defaultExport = part.declaration.name;
    }
  }

  generateSideEffectCodeFromAst = () => {
    return escodegen.generate(this.rootScope.astNode);
  }
  DCE = () => {
    this.rootScope.DCE();
  }
  checkHasSideEffect = (decl) => {
    return this.rootScope.usedDeclSet.has(decl);
  }

  resolveImportExport = (exported) => {
    return this.rootScope.setUsedDecl(exported);
  }

  markAllSideEffect = () => {
    this.rootScope.markAllSideEffect();
  }
}
