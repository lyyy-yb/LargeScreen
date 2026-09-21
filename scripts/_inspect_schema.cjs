const fs = require('fs');
const d = JSON.parse(fs.readFileSync('D:\\csss\\LargeScreen\\scripts\\api-docs.json', 'utf8'));
const schemas = d.components.schemas;

function dump(name) {
  console.log(`\n========== ${name} ==========`);
  console.log(JSON.stringify(schemas[name], null, 2));
}

dump('DroneTaskQueryDTO');
dump('DroneTaskVO');
dump('IPageDroneTaskVO');
dump('ResponseDataIPageDroneTaskVO');

// 顺便看下 WurenjiJobDTO / WurenjiPlanDTO，做字段名对照
dump('WurenjiJobDTO');
dump('WurenjiPlanDTO');
dump('ResponseDataListWurenjiJobDTO');
