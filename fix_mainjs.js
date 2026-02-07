// Script to fix main.js by removing cash register code
const fs = require('fs');

// Read the file
const content = fs.readFileSync('src/main.js', 'utf8');
const lines = content.split('\n');

console.log(`Original file has ${lines.length} lines`);

// Remove lines 247-310 (cash view block, 0-indexed so 246-309)
// Remove lines 196-198 (cash button, 0-indexed so 195-197)
const linesToRemove = new Set();

// Cash view block
for (let i = 246; i <= 309; i++) {
    linesToRemove.add(i);
}

// Cash button (adjust for already removed lines)
for (let i = 195; i <= 197; i++) {
    linesToRemove.add(i);
}

const newLines = lines.filter((line, index) => !linesToRemove.has(index));

console.log(`New file has ${newLines.length} lines`);
console.log(`Removed ${lines.length - newLines.length} lines`);

// Write back
fs.writeFileSync('src/main.js', newLines.join('\n'), 'utf8');

console.log('✅ Fixed main.js!');
