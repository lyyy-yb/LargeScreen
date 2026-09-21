const fs = require('fs');
const d = JSON.parse(fs.readFileSync('D:\\csss\\LargeScreen\\scripts\\api-docs.json', 'utf8'));
function dump(name) {
  console.log(`\n========== ${name} ==========`);
  console.log(JSON.stringify(d.components.schemas[name], null, 2));
}
dump('HbdpUploadResource');
dump('ResponseDataListHbdpUploadResource');
// 顺便找一下其他含 Resource 字样的以及 WurenjiFlyResultDTO
for (const name of Object.keys(d.components.schemas)) {
  if (/WurenjiFlyResult|Resource/.test(name)) console.log('schema:', name);
}
dump('WurenjiFlyResultDTO');
dump('ResponseDataListWurenjiFlyResultDTO');
