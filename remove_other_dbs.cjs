const fs = require('fs');
const serverContent = fs.readFileSync('server.ts', 'utf-8');

// We need to remove MySQL and DynamoDB from MOCK_DATABASE
let newContent = serverContent.replace(/\{\s*"id":\s*"aws-rds-mysql"[\s\S]*?\},/g, '');
newContent = newContent.replace(/\{\s*"id":\s*"aws-dynamodb"[\s\S]*?\}\s*\];/g, '];');

fs.writeFileSync('server.ts', newContent);
console.log('Removed MySQL and DynamoDB');
