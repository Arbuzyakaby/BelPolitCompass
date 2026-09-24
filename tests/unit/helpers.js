'use strict';
// Общие помощники модульных тестов: загрузка data.js и исходников без браузера
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function loadData() {
  const window = {};
  vm.runInNewContext(read('js/data.js'), { window });
  // JSON-копия: объекты из vm-контекста иначе не проходят строгое сравнение
  return JSON.parse(JSON.stringify(window.BPC));
}

module.exports = { ROOT, read, loadData };
