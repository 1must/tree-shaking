const TreeShaker = require('treeShaker');


const ts = new TreeShaker('index', __dirname+'/test');

ts.output();