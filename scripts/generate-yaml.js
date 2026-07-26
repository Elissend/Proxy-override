#!/usr/bin/env node
// YAML 生成器:以 proxy-override.js 为唯一语义源,重写 YAML 中三个生成区
// (dns / rule-providers / rules,由 >>> GENERATED:xxx >>> 标记圈定)。
//
//   node scripts/generate-yaml.js           # 重新生成并写盘(若有变化)
//   node scripts/generate-yaml.js --check   # 只校验,过期则退出码 1(CI 用)
//
// 注释保留机制:生成区内的注释行(及其前的空行)按「下一行内容」锚定,
// 重新生成时自动跟随该行移动。锚定要求下一行在本区内唯一——
// 全部规则行(- RULE-SET/- DOMAIN-... 各不相同)均满足,故给规则加注释安全;
// 但若注释锚在重复的字段行上(如 dns 区的 tls://... 、rule-providers 的 type: http)
// 或位于区块末尾,无法可靠附着,会被丢弃并打印 stderr 警告。
// 因此:改分流语义只改 JS;给规则加注释直接写在该规则行上方即可跨生成保留。
//
// 若存在本地实验文件 proxy-override-smart.yaml(不入库),同步更新其生成区。

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const CHECK = process.argv.includes('--check')

// ---- 取得 JS 生成的配置(log 重定向到 stderr) ----
const origLog = console.log
console.log = (...a) => process.stderr.write(a.join(' ') + '\n')
require(path.join(ROOT, 'proxy-override.js'))
const cfg = globalThis.main({ proxies: [{ name: 'stub', type: 'vless' }] })
console.log = origLog

// ---- 极简 YAML 发射器(仅覆盖本配置用到的形状) ----
function scalar(v) {
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  const s = String(v)
  // 含 ": "、行首特殊指示符、" #" 等才需要引号;本配置的值均为安全 plain 标量
  if (/(: )|( #)|^[\-?:,\[\]{}#&*!|>'"%@` ]|^$/.test(s)) return "'" + s.replace(/'/g, "''") + "'"
  return s
}

function emitMap(obj, indent) {
  const pad = ' '.repeat(indent)
  const out = []
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      out.push(pad + k + ':')
      for (const item of v) out.push(pad + '  - ' + scalar(item))
    } else if (v && typeof v === 'object') {
      out.push(pad + k + ':')
      out.push(...emitMap(v, indent + 2))
    } else {
      out.push(pad + k + ': ' + scalar(v))
    }
  }
  return out
}

const PROVIDER_FIELDS = ['type', 'behavior', 'format', 'url', 'path', 'interval', 'proxy']

function buildRegion(name) {
  if (name === 'dns') return ['dns:', ...emitMap(cfg.dns, 2)]
  if (name === 'rule-providers') {
    const out = ['rule-providers:']
    for (const [k, p] of Object.entries(cfg['rule-providers'])) {
      out.push('  ' + k + ':')
      for (const f of PROVIDER_FIELDS) out.push('    ' + f + ': ' + scalar(p[f]))
    }
    return out
  }
  if (name === 'rules') return ['rules:', ...cfg.rules.map(r => '  - ' + r)]
  throw new Error('未知生成区: ' + name)
}

// ---- 注释锚定:从旧区块提取「空行/注释行 → 下一内容行」映射 ----
function extractAnchors(oldLines) {
  const anchors = new Map() // key: 内容行(trim) → 注释块;仅对区内唯一的内容行生效
  const dropped = []        // 无法锚定的注释块(非唯一锚定行 / 区块尾部)
  const counts = new Map()
  for (const l of oldLines) {
    if (l.trim() === '' || l.trim().startsWith('#')) continue
    counts.set(l.trim(), (counts.get(l.trim()) || 0) + 1)
  }
  var warnIfComment = function (block) {
    var c = block.filter(function (x) { return x.trim().startsWith('#') })
    if (c.length) dropped.push(c.join(' | '))
  }
  let pending = []
  for (const l of oldLines) {
    if (l.trim() === '' || l.trim().startsWith('#')) { pending.push(l); continue }
    if (pending.length) {
      if (counts.get(l.trim()) === 1) anchors.set(l.trim(), pending)
      else warnIfComment(pending) // 锚定行在区内不唯一,注释无法可靠附着
    }
    pending = []
  }
  if (pending.length) warnIfComment(pending) // 区块尾部注释(其后无内容行)
  return { anchors: anchors, dropped: dropped }
}

function attachComments(newLines, anchors) {
  const out = []
  const used = new Set()
  for (const l of newLines) {
    var key = l.trim()
    var a = anchors.get(key)
    if (a && !used.has(key)) { out.push(...a); used.add(key) } // 仅附着到首个匹配行,避免重复
    out.push(l)
  }
  for (const [k, v] of anchors) {
    if (!used.has(k)) {
      const c = v.filter(x => x.trim()).join(' | ')
      if (c) process.stderr.write('警告: 锚定行已消失,注释被移除: ' + c.slice(0, 80) + '\n')
    }
  }
  return out
}

// ---- 区块替换 ----
function processFile(file) {
  const text = fs.readFileSync(file, 'utf8')
  let s = text
  for (const name of ['dns', 'rule-providers', 'rules']) {
    const begin = new RegExp('^# >>> GENERATED:' + name + ' >>>.*$', 'm')
    const end = new RegExp('^# <<< GENERATED:' + name + ' <<<.*$', 'm')
    const mb = s.match(begin)
    const me = s.match(end)
    if (!mb || !me) throw new Error(file + ' 缺少生成区标记: ' + name)
    const from = mb.index + mb[0].length + 1
    const to = me.index
    const oldLines = s.slice(from, to).replace(/\n$/, '').split('\n')
    const ex = extractAnchors(oldLines)
    for (const c of ex.dropped) {
      process.stderr.write('警告: [' + name + '] 注释锚定行不唯一或位于区块尾部,已丢弃: ' + c.slice(0, 80) + '\n')
    }
    const newLines = attachComments(buildRegion(name), ex.anchors)
    s = s.slice(0, from) + newLines.join('\n') + '\n' + s.slice(to)
  }
  if (s === text) return false
  if (CHECK) return true
  fs.writeFileSync(file, s)
  return true
}

const target = path.join(ROOT, 'proxy-override.yaml')
const changed = processFile(target)
if (CHECK) {
  if (changed) {
    console.error('proxy-override.yaml 生成区已过期:请运行 node scripts/generate-yaml.js 后重新提交')
    process.exit(1)
  }
  console.log('生成区与 JS 一致')
  process.exit(0)
}
console.log(changed ? 'proxy-override.yaml 生成区已更新' : 'proxy-override.yaml 无变化')

// 本地实验文件同步(不在仓库时静默跳过)
const smart = path.join(ROOT, 'proxy-override-smart.yaml')
if (fs.existsSync(smart)) {
  const c = processFile(smart)
  console.log(c ? 'proxy-override-smart.yaml 生成区已同步' : 'proxy-override-smart.yaml 无变化')
}
