# Tree Shaking Demo
一个简易的 tree shaking 工具。仅支持 js 部分语法。const，let，if，while，function，import， export，export default。
### 实现思路
通过[esprima](https://github.com/jquery/esprima)获取文本的抽象语法树。
本 demo 只关注了5种声明类型
1. ImportDeclaration
2. ExportNamedDeclaration
3. ExportDefaultDeclaration
4. VariableDeclaration
5. FunctionDeclaration

和4种表达式类型
1. IfStatement
2. ForStatement
3. ExpressionStatement
4. WhileStatement

可以在[https://astexplorer.net/](https://astexplorer.net/)观察不同类型的结构

##### context.js
对全局（Program）和还有 IfStatement，ForStatement，WhileStatement 以及被使用的函数FunctionDeclaration 建立 Context，新建上下文时遍历该上线文的顶层语句，收集所有顶层变量声明（`getDeclarations`函数）。先序遍历创建子上下文。
##### module.js
每个 module 包括一个 rootContext 便是该文件全局上下文。收集所有的 import 变量和 export 变量，并通过 import 语句建立 module graph 。connectedModules 收集了对应module的引入文件的信息。
##### treeShaker.js
通过指定入口文件深度优先遍历 module graph 标记每个文件有副作用的  `part`。过滤每个文件中没有被标记的 `part`。通过[escodegen](https://github.com/estools/escodegen)生成js文件。
本 demo 只关注 tree shaking 不支持 bundler 打包成一个文件。
```shell
node . 或者 node index.js 运行
```
将 test 文件夹下的代码 Tree shaking 之后输出在 dist 文件夹下面。