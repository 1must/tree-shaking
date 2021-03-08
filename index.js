const path = require('path');
const TreeShaker = require('./treeShaker');

console.log(__dirname + '/test');
const ts = new TreeShaker('index', __dirname + '/test');

ts.output();