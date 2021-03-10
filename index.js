const path = require('path');
const TreeShaker = require('./treeShaker');

const ts = new TreeShaker('index', __dirname + '/demo');

ts.output();