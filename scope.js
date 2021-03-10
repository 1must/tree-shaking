module.exports = class Scope {
  // Program, IfStatement, ForStatement, WhileStatement, ExpressionStatement, FunctionDeclaration
  constructor(astNode, parent = null, topStatementHandler) {
    this.astNode = astNode;
    this.parent = parent; // parent Scope
    if(parent) parent.children.push(this);
    this.children = [];
    this.topStatementHandler = topStatementHandler

    // all current scope top declaration
    this.declaration2Ast = new Map();
    this.usedDeclSet = new Set();

    this.getDeclarations();
  }

  // find decl and set it used
  setUsedDecl = (decl) => {
    if(this.usedDeclSet.has(decl)) return;
    const astNode = this.declaration2Ast.get(decl)
    if(astNode) {
      this.usedDeclSet.add(decl);
      
      const { type } = astNode;
      if (type === 'FunctionDeclaration') {
        new Scope(astNode, this);
      }
      // export function xxx() {}
      if (type === 'ExportNamedDeclaration') {
        new Scope(astNode.declaration, this);
      }
      return;
    }
    this.parent && this.parent.setUsedDecl(decl);
  }

  traverseScopeTopStmt = (astNodes) => {
    astNodes.forEach(astNode => {
      const { type } = astNode;
      this.topStatementHandler && this.topStatementHandler(astNode);

      if (type === 'ImportDeclaration') {
        const { specifiers } = astNode;
        specifiers.forEach((specifier) => {
          this.declaration2Ast.set(specifier.local.name, specifier);
        });
      } else if (type === 'VariableDeclaration') {
        const { declarations } = astNode;
        declarations.forEach((decl) => {
          this.declaration2Ast.set(decl.id.name, decl);
        })
      } else if (type === 'FunctionDeclaration') {
        this.declaration2Ast.set(astNode.id.name, astNode);
      } else if (type === 'ExportNamedDeclaration') {
        const { declaration } = astNode;
        if (declaration.type === 'FunctionDeclaration') {
          this.declaration2Ast.set(declaration.id.name, astNode);
        }
        if (declaration.type === 'VariableDeclaration') {
          const declarations = declaration.declarations;
          declarations.forEach((decl) => {
            this.declaration2Ast.set(decl.id.name, decl);
          });
        }
        
      } else if (type === 'ExportDefaultDeclaration') {
        this.declaration2Ast.set(astNode.declaration.name, astNode);
      }
    })
  }

  getDeclarations = () => {
    const { type } = this.astNode;
    const body = this.getBody();
    this.traverseScopeTopStmt(body);
    if(type === 'ForStatement') {
      this.astNode.init.declarations.forEach(decl => {
        this.declaration2Ast.set(decl.id.name, decl);
      })
    }
    if (type === 'IfStatement' && this.astNode.alternate) {
      // 'else' and 'else if'
      new Scope(this.astNode.alternate, this.parent);
    }
  }

  getBody = () => {
    const {type} = this.astNode;
    if(type === 'IfStatement') return this.astNode.consequent.body;
    if (type === 'ExportNamedDeclaration') return this.astNode.declaration.body.body;
    return this.astNode.body.body || this.astNode.body;
  }

  getBodyParent = () => {
    const { type } = this.astNode;
    if (type === 'IfStatement') return this.astNode.consequent;
    if (type === 'ExportNamedDeclaration') return this.astNode.declaration.body;
    return this.astNode.body.body ? this.astNode.body : this.astNode;
  }

  traverseSideEffect = (astNode) => {
    const findAndSetIdentifier = (obj) => {
      if(typeof obj !== 'object') return;
      const { type } = obj;
      if (type === 'Identifier') {
        this.setUsedDecl(obj.name);
        return;
      }
      Object.values(obj).forEach(findAndSetIdentifier);
    }

    const { type } = astNode;
    // all statement except ExpressionStatement have side effect
    if(type.endsWith('Statement')) {
      if (type === 'ExpressionStatement') {
        findAndSetIdentifier(astNode);
        return;
      }
      new Scope(astNode, this);
    }

    // const f = func(); or have side effect
    if (type === 'VariableDeclaration') {
      const { declarations } = astNode;
      declarations.forEach(decl => findAndSetIdentifier(decl.init));
    }
    // export const f = func();
    if (type === 'ExportNamedDeclaration') {
      const {declaration} = astNode;
      if (declaration.type === 'VariableDeclaration') {
        const { declarations } = astNode;
      declarations.forEach(decl => findAndSetIdentifier(decl.init));
      }
    }
  }

  getDCEAstBody = (body) => {
    return body.filter(astNode => {
      const { type } = astNode;
      if (type === 'VariableDeclaration') {
        const { declarations } = astNode;
        const newDecls = declarations.filter((decl) => {
          const name = decl.id.name;
          return this.usedDeclSet.has(name);
        })
        astNode.declarations = newDecls;
        return newDecls.length > 0;
      }
      if (type === 'FunctionDeclaration') {
        const name = astNode.id.name;
        return this.usedDeclSet.has(name);
      }
      if (type === 'ExportNamedDeclaration') {
        const { declaration } = astNode;
        if (declaration.type === 'FunctionDeclaration') {
          const name = declaration.id.name;
          return this.usedDeclSet.has(name);;
        }
        if (declaration.type === 'VariableDeclaration') {
          const declarations =
            declaration.declarations;

          const newDecls = declarations.filter((decl) => {
            const name = decl.id.name;
            return this.usedDeclSet.has(name);
          });
          declaration.declarations = newDecls;
          return newDecls.length > 0;
        }
        return true;
      }
      if (type === 'ExportDefaultDeclaration') {
        return this.usedDeclSet.has(astNode.declaration.name);
      }

      return true;
    });
  }

  // dead code elimination
  markAllSideEffect = () => {
    const body = this.getBody();
    body.forEach(this.traverseSideEffect);
    this.children.forEach(child => child.markAllSideEffect());
  }

  DCE = () => {
    this.children.forEach(child => child.DCE());
    const body = this.getBody();
    this.getBodyParent().body = this.getDCEAstBody(body);
  }
  
}