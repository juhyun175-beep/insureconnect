const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not extract function ${name}`);
}

function loadIndexRenderers() {
  const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const script = [
    extractFunction(source, 'knEsc'),
    extractFunction(source, 'splitKnTableCells'),
    extractFunction(source, 'normalizeKnTableLines'),
    extractFunction(source, 'renderTableBlock'),
    extractFunction(source, 'parseKnContent'),
    'this.parseKnContent = parseKnContent;',
  ].join('\n');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return sandbox;
}

function loadDirectRouteRenderers() {
  const source = fs.readFileSync(path.join(root, 'functions/knowledge/[id].js'), 'utf8');
  const script = [
    extractFunction(source, 'esc'),
    extractFunction(source, 'splitTableCells'),
    extractFunction(source, 'normalizeTableLines'),
    extractFunction(source, 'renderTableBlock'),
    extractFunction(source, 'parseContent'),
    'this.parseContent = parseContent;',
  ].join('\n');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return sandbox;
}

const tableContent = `[table]
rows=2,cols=2
H,구분,내용
D,상품 구성,상해 및 질병 입\\,통원(비급여)
상해 및 질병 입\\,통원(급여)
[/table]`;

{
  const { parseKnContent } = loadIndexRenderers();
  const html = parseKnContent(tableContent);
  assert(html.includes('<table'), 'landing page should render a table');
  assert(html.includes('상해 및 질병 입,통원(비급여)'), 'first line in a table cell should render');
  assert(html.includes('상해 및 질병 입,통원(급여)'), 'continued line in a table cell should render');
}

{
  const { parseContent } = loadDirectRouteRenderers();
  const html = parseContent(tableContent);
  assert(html.includes('<table'), 'direct knowledge page should render a table');
  assert(!html.includes('[table]'), 'direct knowledge page should not expose table markup');
  assert(html.includes('상해 및 질병 입,통원(급여)'), 'direct page should keep continued cell lines');
}

console.log('knowledge table rendering tests passed');
