module.exports = class Context {
  // Program, IfStatement, ForStatement, WhileStatement, ExpressionStatement, FunctionDeclaration
  constructor(astNode, parent = null, topStatementHandler) {
    this.astNode = astNode;
    this.parent = parent; // parent Context
    if(parent) parent.children.push(this);
    this.children = [];
    this.topStatementHandler = topStatementHandler

    // all current context top declaration
    this.declaration2Ast = new Map();
    this.usedDeclSet = new Set();

    this.getDeclarations();
  }

  // find decl and set it used
  setUsedDecl = (decl) => {
    if(this.usedDeclSet.has(decl)) return;
    const astNode = this.declaration2Ast.get(decl)
    if(astNode) {
      const { type } = astNode;
      if (type === 'FunctionDeclaration') {
        new Context(astNode, this.parent);
      }
      this.usedDeclSet.add(decl);
      return;
    }
    this.parent && this.parent.setUsedDecl(decl);
  }

  traverseContextTopStmt = (astNodes) => {
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
          this.declaration2Ast.set(declaration.id.name, declaration);
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
    this.traverseContextTopStmt(body);
    if (type === 'IfStatement') {
      // 'else' and 'else if'
      new Context(this.astNode.alternate, this.parent);
    }
    if(type === 'ForStatement') {
      this.astNode.init.declarations.froEach(decl => {
        this.declarationSet.add(decl.id.name);
      })
    }
  }

  getBody = () => {
    const {type} = this.astNode;
    if(type === 'IfStatement') return this.astNode.consequent.body;
    return this.astNode.body.body || this.astNode.body;
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
      new Context(astNode, this);
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
          const name = decl.id.name
          if(this.usedDeclSet.has(name)) {
            return true;
          }
          return false;
        })
        astNode.declaration = newDecls;
        return newDecls.length > 0 ? true : false;
      }
      if (type === 'FunctionDeclaration') {
        const name = astNode.id.name;
        if(this.usedDeclSet.has(name)) return true;
        return false;
      }
      if (type === 'ExportNamedDeclaration') {
        const { declaration } = astNode;
        if (declaration.type === 'FunctionDeclaration') {
          const name = declaration.id.name;
          if(this.usedDeclSet.has(name)) return true;
          return false;
        }
        if (declaration.type === 'VariableDeclarator') {
          const declarations =
            declaration.declarations;

          const newDecls = declarations.filter((decl) => {
            const name = decl.id.name;
            if (this.usedDeclSet.has(name)) return true;
            return false;
          });
          astNode.declaration = newDecls;
          return newDecls.length > 0 ? true : false;
        }
        return true;
      }
      if (type === 'ExportDefaultDeclaration') {
        this.declaration2Ast.set(astNode.declaration.name, astNode);
      }

      return true;
    });
  }

  // dead code elimination
  markAllSideEffect = () => {
    this.children.forEach(child => child.markAllSideEffect());
    const body = this.getBody();
    body.forEach(this.traverseSideEffect);
  }

  DCE = () => {
    this.children.forEach(child => child.DCE());
    const body = this.getBody();
    this.astNode.body = this.getDCEAstBody(body);
  }
  
}