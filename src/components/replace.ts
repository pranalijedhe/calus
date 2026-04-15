import fs from 'fs';
import path from 'path';

const files = [
  'src/components/CalculatorView.tsx',
  'src/components/ReportsView.tsx',
  'src/components/AdminView.tsx'
];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/bg-\[#141414\]/g, 'bg-[#141414]/60 backdrop-blur-md');
  content = content.replace(/bg-\[#1a1a1a\]/g, 'bg-[#1a1a1a]/60 backdrop-blur-sm');
  fs.writeFileSync(filePath, content);
});
console.log('Replaced successfully');
