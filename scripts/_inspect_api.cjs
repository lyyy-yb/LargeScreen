const fs = require('fs');
const d = JSON.parse(fs.readFileSync('D:\\csss\\LargeScreen\\scripts\\api-docs.json', 'utf8'));

const keys = Object.keys(d.paths).filter(p => /drone-task|wurenji|flyJob|flyPlan/.test(p));
console.log('--- matching paths ---');
for (const p of keys) {
  const ops = d.paths[p];
  for (const m of Object.keys(ops)) {
    const o = ops[m];
    console.log(m.toUpperCase(), p, '|', o.summary || o.operationId || '');
    if (o.parameters) {
      console.log('  params:', JSON.stringify(o.parameters.map(pp => {
        if (pp.schema) return pp.name + '/in=' + pp.in + '/type=' + (pp.schema.type || '');
        return pp.name + '/ref';
      })));
    }
    if (o.requestBody) {
      const json = o.requestBody.content && o.requestBody.content['application/json'];
      if (json) console.log('  reqBody schema:', JSON.stringify(json.schema));
    }
    if (o.responses) {
      for (const code of Object.keys(o.responses)) {
        if (code !== '200' && code !== '0') continue;
        const r = o.responses[code];
        if (r.content) {
          const json = r.content['application/json'];
          if (json) console.log('  resp', code, 'sch:', JSON.stringify(json.schema));
        }
      }
    }
  }
}
