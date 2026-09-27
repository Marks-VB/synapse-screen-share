import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src');
let issues = 0;
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const hooks = ['useState', 'useEffect', 'useRef', 'useCallback', 'useMemo'];
  hooks.forEach(h => {
    const regex = new RegExp(`\\b${h}\\b`, 'g');
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      // Find import line
      const lines = content.split('\n');
      const importLines = lines.filter(l => (l.includes("from 'react'") || l.includes('from "react"')));
      const hasHook = importLines.some(l => l.includes(h));
      if (!hasHook) {
        console.log(`❌ [MISSING IMPORT]: "${h}" is used in ${f} but not imported from 'react'!`);
        issues++;
      }
    }
  });
});

if (issues === 0) {
  console.log('✅ All React hooks are properly imported across all src files!');
}
