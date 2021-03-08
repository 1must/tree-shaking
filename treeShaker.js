
const fs = require('fs');
const Module = require('./module');

module.exports = class TreeShaker {
  constructor(entryName, directory, outPutDirectory = 'dist') {
    this.cachedModuleName = new Map();
    this.modules = [];
    this.directory = directory;
    this.outputDirectory = outPutDirectory;
    const module = this.getModuleByName(entryName);
    this.traverseModuleGraph(module)
  }

  connectModules = (module1, module2, connectInfo) => {
    const { importedInfo, defaultExport } = connectInfo;
    if (defaultExport && module1.checkHasSideEffect(defaultExport)) {
      module2.resolveImportExport(module2.defaultExport);
    }
    importedInfo.forEach(({local, imported}) => {
      if (module1.checkHasSideEffect(local)) {
        module2.resolveImportExport(imported)
      }
    })
  }

  traverseModuleGraph = (module) => {
    module.markAllSideEffect();
    module.connectedModules.forEach(moduleInfo => {
      const { path } = moduleInfo;
      const newModule = this.getModuleByName(path);
      this.connectModules(module, newModule, moduleInfo);
      this.traverseModuleGraph(newModule);
    })
  }

  getModuleByName = (name) => {
    let module = this.cachedModuleName.get(name);
    if(!module) {
      module = new Module(this.directory, name);
      this.modules.push(module);
      this.cachedModuleName.set(name, module);
    }
    return module; 
  }

  output = () => {
    if(!this.outputDirectory) {
      return;
    }
    fs.mkdirSync(this.outputDirectory, { recursive: true });
    this.modules.forEach(module => {
      module.DCE();
      const path = `${this.outputDirectory}/${module.name}.js`;
      fs.writeFileSync(path, module.generateSideEffectCodeFromAst());
    })
  }
}
