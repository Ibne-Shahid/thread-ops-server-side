const fs = require('fs');
const key = fs.readFileSync('./thread-ops-firebase-adminsdk-fbsvc-da426993cd.json', 'utf8')
const base64 = Buffer.from(key).toString('base64')
console.log(base64)