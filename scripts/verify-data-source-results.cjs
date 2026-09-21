const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync('src/pages/manage/dataSource.tsx', 'utf8')
const file = ts.createSourceFile('dataSource.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const handlers = {}
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['handleOk', 'handleDelete', 'toggleStatus'].includes(node.name.getText(file))) {
    handlers[node.name.getText(file)] = node.initializer.getText(file)
  }
  ts.forEachChild(node, visit)
}
visit(file)
const helperSource = fs.readFileSync('src/servers/alertFollowUp.ts', 'utf8')
const helperFile = ts.createSourceFile('helper.ts', helperSource, ts.ScriptTarget.Latest, true)
const helper = helperFile.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'requireSuccess').getText(helperFile).replace('export ', '')
const compiled = ts.transpileModule(helper + '\n' + Object.entries(handlers).map(([name, fn]) => `const ${name} = ${fn}`).join('\n') + '\nthis.handlers = {handleOk, handleDelete, toggleStatus}', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
async function check(operation, response, succeeds) {
  const events = []
  let pending
  const ctx = {
    editingItem: operation === 'edit' ? { id: 1 } : null,
    form: {
      validateFields: () => ({ then: fn => { pending = fn({ lng: 120, lat: 30, enabled: true }) } }),
      resetFields: () => events.push('reset'),
    },
    dataSourceApi: Object.fromEntries(['add', 'edit', 'remove', 'changeStatus'].map(name => [name, async () => response])),
    message: { success: () => events.push('success'), error: () => events.push('error') },
    modal: { confirm: options => { pending = options.onOk() } },
    setSubmitting() {},
    setIsModalVisible: () => events.push('close'),
    fetchData: () => events.push('refresh'),
    redirectToLoginOnExpired() {},
  }
  vm.createContext(ctx)
  vm.runInContext(compiled, ctx)
  if (operation === 'remove') ctx.handlers.handleDelete(1)
  else if (operation === 'changeStatus') pending = ctx.handlers.toggleStatus({ id: 1, enabled: 1 })
  else ctx.handlers.handleOk()
  if (!succeeds && operation === 'remove') await assert.rejects(pending)
  else await pending
  assert.deepEqual(events, succeeds
    ? (['add', 'edit'].includes(operation) ? ['success', 'close', 'reset', 'refresh'] : ['success', 'refresh'])
    : ['error'], `${operation}: ${JSON.stringify(response)}`)
}
;(async () => {
  for (const operation of ['add', 'edit', 'remove', 'changeStatus']) {
    for (const response of [{ code: 500, msg: '操作失败' }, { resultCode: 1, message: '拒绝' }, { code: 500, resultCode: 0 }]) await check(operation, response, false)
    for (const response of [{ code: 200 }, { resultCode: 0 }]) await check(operation, response, true)
  }
  console.log('PASS: 数据源新增、编辑、删除、启停的业务失败不提示成功、不关闭清空表单、不刷新；两种成功码正常执行')
})().catch(error => { console.error(error); process.exitCode = 1 })
