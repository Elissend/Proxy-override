#!/usr/bin/env node
// 语义校验脚本(本地与 CI 通用)
//   node scripts/validate.js          # 运行全部断言
//   node scripts/validate.js --dump   # 输出生成的配置 JSON(供 validate.py 对比)
//   node scripts/validate.js --urls   # 输出全部规则集 URL(供可达性检查)
//
// 注意:配置演进时需同步更新下方 EXPECTED 常量——这是有意设计,
// 强制每次规则增删都经过一次清点确认。

const EXPECTED = {
  RULES: 170,
  PROVIDERS: 47,
  DOMAIN_REGEX: 17,
  KEEP_ALIVE_IDLE: 600,
  KEEP_ALIVE_INTERVAL: 60,
  DNS_POLICY_KEY: 'rule-set:cn_sites,geolocation-cn,bilibili',
  // 仅供 DNS 分流引用、不出现在规则里的 provider
  DNS_ONLY_PROVIDERS: ['bilibili', 'geolocation-cn'],
}

// 脚本内部的 log() 会绑定 console.log,先重定向到 stderr 保持 stdout 干净
const origLog = console.log
console.log = (...a) => process.stderr.write(a.join(' ') + '\n')
require(require('path').join(__dirname, '..', 'proxy-override.js'))

const cfg = globalThis.main({
  proxies: [
    { name: 'HK-vless', type: 'vless' },
    { name: 'US-hy2', type: 'hysteria2' },
    { name: 'JP-fp', type: 'trojan', 'client-fingerprint': 'safari' },
    { name: '官网登录', type: 'vless' }, // 应被信息节点过滤
  ],
})
console.log = origLog

const mode = process.argv[2]
if (mode === '--dump') {
  console.log(JSON.stringify({ rules: cfg.rules, providers: cfg['rule-providers'], dns: cfg.dns }))
  process.exit(0)
}
if (mode === '--urls') {
  for (const p of Object.values(cfg['rule-providers'])) console.log(p.url)
  process.exit(0)
}

const errs = []
const ok = (cond, msg) => { if (!cond) errs.push(msg) }
const rules = cfg.rules
const RP = cfg['rule-providers']

// 规模
ok(rules.length === EXPECTED.RULES, `规则数 ${rules.length} != ${EXPECTED.RULES}`)
ok(Object.keys(RP).length === EXPECTED.PROVIDERS, `provider 数 ${Object.keys(RP).length} != ${EXPECTED.PROVIDERS}`)

// 全 mrs 化不回退
ok(!rules.some(r => r.includes('GEOSITE,') || r.includes('GEOIP,')), '规则中出现 GEOSITE/GEOIP 残留')
ok(!('geox-url' in cfg) && !('geo-auto-update' in cfg), 'geo 数据依赖回归')
ok(!cfg.dns['fake-ip-filter'].some(x => String(x).startsWith('geosite:')), 'fake-ip-filter 出现 geosite 引用')

// DOMAIN-REGEX 补偿:数量与逗号安全(正则串内不允许逗号)
const rx = rules.filter(r => r.startsWith('DOMAIN-REGEX,'))
ok(rx.length === EXPECTED.DOMAIN_REGEX, `DOMAIN-REGEX 数 ${rx.length} != ${EXPECTED.DOMAIN_REGEX}`)
ok(rx.every(r => r.split(',').length === 3), 'DOMAIN-REGEX 存在逗号污染(规则串逗号为分隔符)')

// 引用完整性
const used = new Set()
for (const r of rules) for (const m of r.matchAll(/RULE-SET,([^,)]+)/g)) used.add(m[1])
for (const u of used) ok(u in RP, `规则引用未定义的 provider: ${u}`)
const unused = Object.keys(RP).filter(k => !used.has(k)).sort()
ok(JSON.stringify(unused) === JSON.stringify(EXPECTED.DNS_ONLY_PROVIDERS.slice().sort()),
  `未引用 provider 集合异常: ${unused}`)

// provider 规范
for (const [k, p] of Object.entries(RP)) {
  ok(p.format === 'mrs' && p.proxy === 'DIRECT', `provider ${k} format/proxy 异常`)
  ok(p.interval >= 85500 && p.interval < 86400, `provider ${k} interval 越界: ${p.interval}`)
}
for (const k of ['private-ip', 'cn-ip', 'telegram-ip']) ok(RP[k] && RP[k].behavior === 'ipcidr', `${k} 应为 ipcidr`)

// DNS
ok(Object.keys(cfg.dns['nameserver-policy'])[0] === EXPECTED.DNS_POLICY_KEY, 'DNS nameserver-policy 键漂移')
ok(cfg.dns['respect-rules'] === true, 'respect-rules 丢失')

// 省电参数
ok(cfg['keep-alive-idle'] === EXPECTED.KEEP_ALIVE_IDLE && cfg['keep-alive-interval'] === EXPECTED.KEEP_ALIVE_INTERVAL,
  'keep-alive 参数漂移')

// uTLS 逐节点注入
const ps = cfg.proxies
ok(ps[0]['client-fingerprint'] === 'chrome', 'vless 未注入指纹')
ok(!ps[1]['client-fingerprint'], 'hysteria2 不应注入指纹')
ok(ps[2]['client-fingerprint'] === 'safari', '节点自带指纹被覆盖')

// 信息节点过滤 + 规则首尾
ok(cfg['proxy-groups'].find(g => g.name === '自动选择').proxies.length === 3, '信息节点过滤失效')
ok(rules[0].startsWith('PROCESS-NAME,'), '首条规则应为 BT 进程直连')
ok(rules[rules.length - 1] === 'MATCH,漏网之鱼', '末条规则应为 MATCH 兜底')

if (errs.length) {
  console.error('校验失败:')
  errs.forEach(e => console.error(' -', e))
  process.exit(1)
}
console.log(`校验通过:${rules.length} 条规则 / ${Object.keys(RP).length} 个规则集 / ${rx.length} 条正则补偿`)
