const fs = require('fs');
const serverContent = fs.readFileSync('server.ts', 'utf-8');
const dbInstances = fs.readFileSync('db_instances.json', 'utf-8');

// Find the start and end of MOCK_DATABASE
const startRegex = /const MOCK_DATABASE = \[/;
const endRegex = /\];\n\nconst MOCK_NETWORKING/;

const startMatch = serverContent.match(startRegex);
const endMatch = serverContent.match(endRegex);

if (startMatch && endMatch) {
  const startIndex = startMatch.index;
  const endIndex = endMatch.index + 1; // include the closing bracket
  
  const newContent = serverContent.substring(0, startIndex) + 
                     'const MOCK_DATABASE = ' + dbInstances + 
                     serverContent.substring(endIndex);
                     
  fs.writeFileSync('server.ts', newContent);
  console.log('Successfully injected MOCK_DATABASE');
} else {
  console.log('Could not find MOCK_DATABASE bounds');
}
