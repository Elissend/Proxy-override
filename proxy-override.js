// Mihomo 覆写脚本
// 版本：v3.3 (2026-07-26)
// 适用：支持 JavaScript 覆写的 Mihomo 客户端；TUN 由客户端自行控制
//
// 导入方法：在客户端中创建覆写脚本并粘贴本文件全部内容，
// 再到订阅的「覆写」设置中启用该脚本，刷新订阅生效。
// 具体入口以客户端说明为准，README 有详细步骤说明。

const VERSION = 'v3.3'

// 兼容部分 Mihomo 客户端精简的 JS 运行环境（console 可能不存在）
var log = (typeof console !== 'undefined' && console.log) ? console.log.bind(console) : function() {}

// CDN 基地址——所有远程规则集 / GeoX 数据共用
// 中国大陆用户遇到下载失败可尝试替换为以下任一镜像：
//   testingcf.jsdelivr.net — Cloudflare CDN
//   gcore.jsdelivr.net     — Gcore CDN
const CDN_BASE = 'https://fastly.jsdelivr.net'

// ---- 个人自定义区 —— 使用者请按需修改或清空以下两个列表 ----

// 自定义直连域名（前置放行：优先级高于广告拦截和所有业务分流，
// 适合放行你自己常用的小程序、公司内网、学校系统等域名）
var CUSTOM_DIRECT_DOMAINS = [
  'school-wx.qshnhealth.com',  // 示例：校园健康小程序
  'xindazhilian.com',
  'chiphell.com',
  'halo.run'
]

// 自定义直连端口（游戏、远程工具等私有服务）
var CUSTOM_DIRECT_PORTS = [33068, 6540, 26880]

// ---- 全局参数 / DNS / Sniffer 覆写 ----

function overwriteGeneral(config) {
  config['unified-delay'] = true
  config['tcp-concurrent'] = true
  config['keep-alive-idle'] = 30
  config['keep-alive-interval'] = 15
  // uTLS 指纹伪装（对 vmess/vless 等基于 TLS 的节点生效）
  config['global-client-fingerprint'] = 'chrome'

  if (!config.profile) config.profile = {}
  config.profile['store-selected'] = true
  // 重启后保留 fake-ip 映射，避免应用 DNS 缓存指向失效地址导致短暂断流
  config.profile['store-fake-ip'] = true

  config['geox-url'] = {
    geosite: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@release/geosite.dat',
    geoip: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@release/geoip.dat'
  }
  // geosite/geoip 数据自动更新（否则 .dat 只在首次下载，之后永不更新）
  config['geo-auto-update'] = true
  config['geo-update-interval'] = 24

  // 注：external-controller / secret 由 Mihomo 客户端自行管理，
  // 覆写脚本不设置，避免破坏客户端与内核的通信；独立部署请用 YAML 模板

  // --- Sniffer ---
  config.sniffer = {
    enable: true,
    'force-dns-mapping': true,
    'parse-pure-ip': true,
    'override-destination': true,
    sniff: {
      TLS: { ports: [443, 8443] },
      HTTP: { ports: [80, '8080-8880'] },
      QUIC: { ports: [443, 8443] }
    },
    'force-domain': [
      '+.netlify.app',
      '+.vercel.app',
      '+.workers.dev'
    ],
    'skip-domain': [
      '+.mijia.cloud',
      '+.oray.com',
      '+.oray.net',
      '+.apple.com'
    ]
  }

  // --- DNS 全加密 ---
  config.dns = {
    enable: true,
    listen: '127.0.0.1:1053',
    ipv6: false,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    'fake-ip-filter': [
      // geosite:private 覆盖 .home.arpa / .internal 等更多局域网域名形式
      'geosite:private',
      '+.lan', '+.local', '+.localhost', '+.direct',
      '+.msftconnecttest.com', '+.msftncsi.com',
      '+.baidu.com', '+.bilibili.com', '+.bing.com', '+.chiphell.com',
      '+.oray.com', '+.sunlogin.com', '+.todesk.com', '+.rustdesk.com',
      '+.teamviewer.com', '+.anydesk.com', '+.tailscale.com', '+.zerotier.com', '+.nvidia.com',
      '+.ntp.org', '+.pool.ntp.org',
      '+.time.apple.com', '+.time.google.com', '+.time.nist.gov',
      'time.windows.com',
      'ip.cip.cc',
      'captive.apple.com', 'connectivitycheck.gstatic.com', 'id6.me',
      // 微信/QQ 全家桶不走 fake-ip（登录、语音通话对 DNS 结果敏感）
      '+.qq.com', '+.wechat.com', '+.weixinbridge.com',
      '+.cmpassport.com',
      '+.mcdn.bilivideo.cn',
      '+.battlenet.com.cn', '+.wotgame.cn', '+.wggames.cn', '+.wowsgame.cn',
    ],
    'default-nameserver': ['tls://223.5.5.5', 'tls://223.6.6.6'],
    'proxy-server-nameserver': ['https://doh.pub/dns-query', 'tls://223.5.5.5'],
    'direct-nameserver': ['https://dns.alidns.com/dns-query'],
    // 注：biliintl（海外站）与 aistudio 已删——它们路由到代理组，
    // fake-ip 模式下本地解析结果不会被使用，属于死条目
    'nameserver-policy': {
      'geosite:cn,geolocation-cn,bilibili': [
        'https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query',
        'tls://223.5.5.5', 'tls://223.6.6.6'
      ]
    },
    nameserver: ['https://dns.cloudflare.com/dns-query', 'https://dns.google/dns-query'],
    'respect-rules': true,
    'direct-nameserver-follow-policy': true
  }
}

// ---- 判断是否为信息/过期节点 ----

function isInfoNode(name) {
  if (!name || typeof name !== 'string') return true
  return /(剩余|到期|官网|套餐|流量|网址|地址|过期|重置|更新|应急|免费|试用|Sign|Login|Register|Help|FAQ|客服|联系|网站)/i.test(name)
}

// ---- 节点分类 ----

function classifyAllNodes(proxies) {
  var all = []
  for (var i = 0; i < proxies.length; i++) {
    var p = proxies[i]
    if (!p || typeof p !== 'object' || !p.name) continue
    if (isInfoNode(p.name)) continue
    all.push(String(p.name))
  }
  return { ALL: all }
}

// ---- 策略组创建 ----

function upsertGroup(config, group) {
  var groups = config['proxy-groups']
  var idx = -1
  for (var i = 0; i < groups.length; i++) {
    if (groups[i] && groups[i].name === group.name) { idx = i; break }
  }
  if (idx !== -1) { groups[idx] = group }
  else { groups.push(group) }
  log('[' + VERSION + '] ' + group.type + ': "' + group.name + '" -> ' + (group.proxies ? group.proxies.length : 0) + ' nodes')
}

function buildProxyGroups(config, c) {
  var allNodes = c.ALL.slice()
  var ICON = 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/'

  upsertGroup(config, {
    name: '节点选择', type: 'select',
    icon: ICON + 'Available.png',
    proxies: ['自动选择', '故障转移'].concat(allNodes).concat(['DIRECT'])
  })

  upsertGroup(config, {
    name: '自动选择', type: 'url-test',
    icon: ICON + 'Auto.png',
    url: 'http://www.gstatic.com/generate_204',
    interval: 300, tolerance: 150, lazy: true,
    proxies: allNodes.slice()
  })

  upsertGroup(config, {
    name: '故障转移', type: 'fallback',
    icon: ICON + 'Round_Robin.png',
    url: 'http://www.gstatic.com/generate_204',
    interval: 300, lazy: true,
    proxies: allNodes.slice()
  })

  // 业务策略组 — 节点选择排最前，后面跟全部节点
  var bizGroup = ['节点选择', '自动选择', '故障转移'].concat(allNodes).concat(['DIRECT'])

  upsertGroup(config, { name: 'AI',       type: 'select', icon: ICON + 'ChatGPT.png',           proxies: bizGroup.slice() })
  upsertGroup(config, { name: 'YouTube',  type: 'select', icon: ICON + 'YouTube.png',       proxies: bizGroup.slice() })
  upsertGroup(config, { name: 'Telegram', type: 'select', icon: ICON + 'Telegram.png',      proxies: bizGroup.slice() })
  upsertGroup(config, { name: '海外社交', type: 'select', icon: ICON + 'Discord.png',       proxies: bizGroup.slice() })
  upsertGroup(config, { name: '流媒体',   type: 'select', icon: ICON + 'ForeignMedia.png',  proxies: bizGroup.slice() })
  upsertGroup(config, { name: 'Google',   type: 'select', icon: ICON + 'Google.png',        proxies: bizGroup.slice() })
  upsertGroup(config, { name: '开发工具', type: 'select', icon: ICON + 'GitHub.png',        proxies: bizGroup.slice() })
  upsertGroup(config, { name: '海外游戏', type: 'select', icon: ICON + 'Steam.png',         proxies: bizGroup.slice() })

  var appleGroup = ['DIRECT', '节点选择', '自动选择', '故障转移'].concat(allNodes)
  upsertGroup(config, { name: '苹果',     type: 'select', icon: ICON + 'Apple.png',         proxies: appleGroup.slice() })
  upsertGroup(config, { name: '微软',     type: 'select', icon: ICON + 'Microsoft.png',     proxies: appleGroup.slice() })

  upsertGroup(config, { name: '国内直连', type: 'select', icon: ICON + 'Direct.png',  proxies: ['DIRECT'] })
  upsertGroup(config, { name: '广告拦截', type: 'select', icon: ICON + 'AdBlack.png', proxies: ['REJECT', 'DIRECT'] })

  var finalGroup = ['节点选择', '自动选择', '故障转移'].concat(allNodes).concat(['DIRECT', 'REJECT'])
  upsertGroup(config, { name: '漏网之鱼', type: 'select', icon: ICON + 'Final.png', proxies: finalGroup.slice() })
}

// ---- 清理订阅自带旧组和旧规则 ----

function cleanupSubscription(config) {
  if (!Array.isArray(config['proxy-groups'])) config['proxy-groups'] = []
  if (!Array.isArray(config.rules)) config.rules = []

  var removedGroups = config['proxy-groups'].length
  if (removedGroups > 0) config['proxy-groups'].splice(0, removedGroups)
  if (config.rules.length > 0) config.rules.splice(0, config.rules.length)
  if (config['rule-providers']) {
    Object.keys(config['rule-providers']).forEach(function(k) { delete config['rule-providers'][k] })
  }
  log('[' + VERSION + '] Cleared ' + removedGroups + ' subscription groups; rebuilding from override')
}

// ---- 远程规则集 ----

function injectRuleProviders(config) {
  if (!config['rule-providers']) config['rule-providers'] = {}

  var RP = config['rule-providers']

  // 下载统一走 DIRECT：指向策略组时，首次启动或组内选中节点故障会导致
  // 规则集静默更新失败；fastly.jsdelivr.net 国内可直连，失败可换镜像

  RP['anti-ad'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/DustinWin/ruleset_geodata@mihomo-ruleset/ads.mrs',
    path: './ruleset/anti-ad.mrs', interval: 85515, proxy: 'DIRECT' }

  // 公共 BT tracker（BT 流量必须直连：机场普遍禁 P2P，走代理有封号风险）
  RP['bt-tracker'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/category-public-tracker.mrs',
    path: './ruleset/bt-tracker.mrs', interval: 86475, proxy: 'DIRECT' }

  // 国内 HTTPDNS 服务端点（拦截后 App 回落系统 DNS，防止绕过域名分流）
  RP['httpdns'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/category-httpdns-cn.mrs',
    path: './ruleset/httpdns.mrs', interval: 86490, proxy: 'DIRECT' }

  // category-ai-!cn 含 OpenAI/Claude/Gemini/Copilot/Perplexity/Mistral 等主流 AI 服务
  RP['ai'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/category-ai-!cn.mrs',
    path: './ruleset/meta-ai.mrs', interval: 85530, proxy: 'DIRECT' }

  RP['tiktok'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/tiktok.mrs',
    path: './ruleset/meta-tiktok.mrs', interval: 85575, proxy: 'DIRECT' }

  RP['github'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/github.mrs',
    path: './ruleset/meta-github.mrs', interval: 85635, proxy: 'DIRECT' }

  RP['microsoft'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/microsoft.mrs',
    path: './ruleset/meta-microsoft.mrs', interval: 85650, proxy: 'DIRECT' }

  RP['apple'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/apple.mrs',
    path: './ruleset/meta-apple.mrs', interval: 85665, proxy: 'DIRECT' }

  RP['proxy_sites'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/geolocation-!cn.mrs',
    path: './ruleset/proxy_sites.mrs', interval: 86415, proxy: 'DIRECT' }

  RP['cn_sites'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/cn.mrs',
    path: './ruleset/cn_sites.mrs', interval: 86430, proxy: 'DIRECT' }

  RP['gfw'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/gfw.mrs',
    path: './ruleset/meta-gfw.mrs', interval: 86445, proxy: 'DIRECT' }

  log('[' + VERSION + '] Injected ' + Object.keys(RP).length + ' rule-providers')
}

// ---- 分流规则 ----

function injectRules(config) {
  var R = config.rules

  // BT / P2P 直连（放最前：机场普遍禁 BT，走代理有封号风险，
  // 且 tracker 拿到代理 IP 会拖慢下载）
  var btClients = [
    'qbittorrent.exe', 'BitComet.exe', 'uTorrent.exe',
    'transmission-qt.exe', 'aria2c.exe', 'Thunder.exe'
  ]
  for (var b = 0; b < btClients.length; b++) {
    R.push('PROCESS-NAME,' + btClients[b] + ',DIRECT')
  }
  R.push('RULE-SET,bt-tracker,DIRECT')

  // 个人自定义直连（列表在文件顶部"个人自定义区"维护）
  for (var u = 0; u < CUSTOM_DIRECT_DOMAINS.length; u++) {
    R.push('DOMAIN-SUFFIX,' + CUSTOM_DIRECT_DOMAINS[u] + ',DIRECT')
  }
  for (var v = 0; v < CUSTOM_DIRECT_PORTS.length; v++) {
    R.push('DST-PORT,' + CUSTOM_DIRECT_PORTS[v] + ',DIRECT')
  }

  // 微信小程序基础设施（anti-ad 规则集可能误伤 *.wxs.qq.com 等子域名，优先放行）
  R.push('DOMAIN-SUFFIX,wxs.qq.com,DIRECT')
  R.push('DOMAIN-SUFFIX,wx.qlogo.cn,DIRECT')
  R.push('DOMAIN-SUFFIX,servicewechat.com,DIRECT')
  R.push('DOMAIN-SUFFIX,mp.weixin.qq.com,DIRECT')

  // 火山引擎 APM / 极光推送（anti-ad 规则集误伤，米哈游等国服游戏基础设施）
  R.push('DOMAIN,apmplus.volces.com,DIRECT')
  R.push('DOMAIN-SUFFIX,jpush.io,DIRECT')
  R.push('DOMAIN-SUFFIX,jpush.cn,DIRECT')
  R.push('DOMAIN,easytomessage.com,DIRECT')
  // 友盟推送/错误日志（国内大量 App 依赖）
  R.push('DOMAIN,msg.umeng.com,DIRECT')
  R.push('DOMAIN,msg.umengcloud.com,DIRECT')
  R.push('DOMAIN,errlog.umeng.com,DIRECT')
  // 归因 SDK（Adjust/AppsFlyer，国内 App 广泛集成，被广告规则误伤）
  R.push('DOMAIN,app.adjust.com,DIRECT')
  R.push('DOMAIN,app.appsflyer.com,DIRECT')
  // 公共 CDN
  R.push('DOMAIN-SUFFIX,baomitu.com,DIRECT')
  R.push('DOMAIN-SUFFIX,bootcss.com,DIRECT')
  R.push('DOMAIN-SUFFIX,staticfile.org,DIRECT')
  R.push('DOMAIN-SUFFIX,upaiyun.com,DIRECT')
  // Android 系统服务（被墙，走代理；广告规则可能误伤需前置放行）
  R.push('DOMAIN-SUFFIX,mtalk.google.com,Google')
  R.push('DOMAIN,clientservices.googleapis.com,Google')
  R.push('DOMAIN,update.googleapis.com,Google')
  R.push('DOMAIN-SUFFIX,dl.google.com,Google')
  R.push('DOMAIN-SUFFIX,dl.l.google.com,Google')

  // HTTPDNS 拦截（在误伤放行之后：国内 App 用 HTTPDNS 拿真实 IP 直连，
  // 会绕过域名分流；拦截后 App 回落系统 DNS。个别 App 异常时在此前加 DIRECT 放行）
  R.push('RULE-SET,httpdns,REJECT')

  // 局域网 / 私有网络（必须在 QUIC 阻断之前：局域网纯 IP 流量匹配不了
  // domain 类型的 cn_sites，NOT 取反后 UDP 443 会被误 REJECT）
  R.push('DST-PORT,7680,REJECT')
  R.push('GEOSITE,private,DIRECT')
  R.push('GEOIP,private,DIRECT,no-resolve')
  R.push('DOMAIN,localhost,DIRECT')
  R.push('DOMAIN-SUFFIX,local,DIRECT')

  // 国内 IP 提前直连（no-resolve：仅命中无域名的纯 IP 流量，
  // 顺带豁免国内 IP 的 QUIC 阻断；域名流量不受影响）
  R.push('GEOIP,CN,国内直连,no-resolve')

  // 广告拦截
  R.push('GEOSITE,category-ads-all,广告拦截')
  R.push('RULE-SET,anti-ad,广告拦截')

  // QUIC 阻断（微软/苹果/YouTube/Google 豁免，其余非中国站点 REJECT）
  R.push('AND,((DST-PORT,443),(NETWORK,UDP),(RULE-SET,microsoft)),微软')
  R.push('AND,((DST-PORT,443),(NETWORK,UDP),(RULE-SET,apple)),苹果')
  R.push('AND,((DST-PORT,443),(NETWORK,UDP),(GEOSITE,youtube)),YouTube')
  R.push('AND,((DST-PORT,443),(NETWORK,UDP),(GEOSITE,google)),Google')
  R.push('AND,((DST-PORT,443),(NETWORK,UDP),(NOT,((RULE-SET,cn_sites)))),REJECT')

  // 前置拦截（规则集 CDN / DoH 域名）
  R.push('DOMAIN-SUFFIX,jsdelivr.net,节点选择')
  R.push('DOMAIN,dns.google,节点选择')
  R.push('DOMAIN,dns.google.com,节点选择')
  R.push('DOMAIN,dns.cloudflare.com,节点选择')

  // YouTube
  R.push('GEOSITE,youtube,YouTube')

  // AI（须在 GEOSITE,google 之前：category-ai-!cn 含 gemini/aistudio 等
  // Google 域名，确保它们归入对地区敏感的 AI 组）
  R.push('RULE-SET,ai,AI')
  // 以下为 category-ai-!cn 未覆盖的补充域名
  var aiDomains = [
    'stability.ai', 'replicate.com', 'together.ai',
    'suno.ai', 'suno.com', 'runpod.io'
  ]
  for (var j = 0; j < aiDomains.length; j++) {
    R.push('DOMAIN-SUFFIX,' + aiDomains[j] + ',AI')
  }

  // Google 服务（放在 AI 之后，避免遮蔽特定 API 子域名；
  // GEOSITE,google 已含 gstatic.com / googleapis.com 等全部 Google 域名）
  R.push('GEOSITE,google,Google')

  // 注：DeepSeek 等国内 AI 无需单独规则——category-ai-!cn 按命名契约
  // 排除国内服务（已逐一验证），cn 规则集兜底直连
  // Telegram（客户端大量使用纯 IP 直连且无 SNI，GEOIP 规则必不可少，
  // 否则这些流量全部落入漏网之鱼）
  R.push('GEOSITE,telegram,Telegram')
  R.push('GEOIP,telegram,Telegram,no-resolve')

  // 海外社交
  R.push('GEOSITE,twitter,海外社交')
  R.push('GEOSITE,reddit,海外社交')
  R.push('GEOSITE,facebook,海外社交')
  R.push('GEOSITE,instagram,海外社交')
  R.push('GEOSITE,linkedin,海外社交')
  R.push('DOMAIN-SUFFIX,snapchat.com,海外社交')  // snapchat 无 GEOSITE 分类
  R.push('GEOSITE,pinterest,海外社交')
  R.push('GEOSITE,threads,海外社交')
  R.push('GEOSITE,bluesky,海外社交')
  R.push('GEOSITE,quora,海外社交')
  R.push('GEOSITE,medium,海外社交')
  R.push('GEOSITE,imgur,海外社交')
  R.push('GEOSITE,flickr,海外社交')
  R.push('GEOSITE,tumblr,海外社交')
  R.push('GEOSITE,pixiv,海外社交')

  // 字节海外专属
  var bytedanceOverseas = [
    'byteoversea.com', 'byteoversea.net', 'ibytedtos.com', 'ibyteimg.com',
    'byteglb.com', 'larksuite.com', 'lark.com', 'pangle.io'
  ]
  for (var i = 0; i < bytedanceOverseas.length; i++) {
    R.push('DOMAIN-SUFFIX,' + bytedanceOverseas[i] + ',节点选择')
  }
  // 火山引擎是字节国内云（豆包/方舟 API、国服游戏 APM 等），整域直连；
  // 字节海外云是 BytePlus 系域名，不受影响
  R.push('DOMAIN-SUFFIX,volces.com,DIRECT')

  // 流媒体
  R.push('RULE-SET,tiktok,流媒体')
  R.push('GEOSITE,netflix,流媒体')
  R.push('GEOSITE,spotify,流媒体')
  R.push('GEOSITE,hulu,流媒体')
  R.push('GEOSITE,hbo,流媒体')
  R.push('GEOSITE,disney,流媒体')
  R.push('GEOSITE,primevideo,流媒体')
  R.push('GEOSITE,twitch,流媒体')
  R.push('GEOSITE,vimeo,流媒体')
  R.push('GEOSITE,dailymotion,流媒体')
  // 以下 4 项无 GEOSITE 分类，保留硬编码
  R.push('DOMAIN-SUFFIX,discoveryplus.com,流媒体')
  R.push('DOMAIN-SUFFIX,paramountplus.com,流媒体')
  R.push('DOMAIN-SUFFIX,peacocktv.com,流媒体')
  R.push('DOMAIN-SUFFIX,crunchyroll.com,流媒体')

  // 游戏平台：国服直连，海外走代理
  // category-games-cn 含 mihoyo-cn / tencent-games / kurogames / bilibili-game 等
  // category-games-!cn 含 Steam / Epic / Blizzard / Nintendo / PlayStation / Xbox 等
  R.push('GEOSITE,category-games-cn,DIRECT')
  R.push('GEOSITE,category-games-!cn,海外游戏')

  // 开发工具
  // 注：docker/npmjs/pypi/crates/jetbrains/stackoverflow/gitlab/almalinux 等
  //     已由 GEOSITE,category-dev 覆盖，此处仅保留未覆盖的补充域名
  R.push('RULE-SET,github,开发工具')
  var devDomains = [
    'maven.apache.org',
    'vercel.com', 'vercel.app', 'netlify.com', 'netlify.app',
    'pages.dev', 'workers.dev',
    'bitbucket.org',
    'digitalocean.com', 'vultr.com', 'heroku.com', 'fly.io', 'render.com',
    'postman.com', 'notion.so', 'figma.com', 'atlassian.com'
  ]
  for (var d = 0; d < devDomains.length; d++) {
    R.push('DOMAIN-SUFFIX,' + devDomains[d] + ',开发工具')
  }
  // Fedora 镜像直连（Metalink 根据来源 IP 自动分配国内镜像）
  R.push('DOMAIN-SUFFIX,fedoraproject.org,DIRECT')
  // Fermilab 镜像（AlmaLinux 默认仓库，美国服务器）
  R.push('DOMAIN-SUFFIX,linux-mirrors.fnal.gov,开发工具')
  R.push('GEOSITE,category-dev,开发工具')

  // 苹果（apple.com.cn / icloud.com.cn / mzstatic.com 已在 apple 规则集内）
  R.push('DOMAIN-SUFFIX,icloud.com,DIRECT')
  R.push('RULE-SET,apple,苹果')

  // 微软（msftconnecttest / msn.com / live.com / sfx.ms 已在 microsoft 规则集内）
  R.push('DOMAIN-SUFFIX,storeedge.microsoft.com,DIRECT')
  R.push('DOMAIN-SUFFIX,mp.microsoft.com,DIRECT')
  R.push('RULE-SET,microsoft,微软')
  R.push('DOMAIN-SUFFIX,microsoft.cn,微软')

  // 国内直连（严格说与 cn 规则集重复，保留意图：首次启动 cn_sites.mrs
  // 尚未下载成功时，头部站点仍能直连保底；成本可忽略）
  var cnDomains = [
    'baidu.com', 'bdstatic.com', 'bilibili.com',
    'alicdn.com', 'alipay.com', 'taobao.com', 'aliyuncs.com',
    'qcloud.com', 'myqcloud.com',
    'feishu.cn', 'dingtalk.com',
    '163.com', '126.com', '126.net'
  ]
  for (var c = 0; c < cnDomains.length; c++) {
    R.push('DOMAIN-SUFFIX,' + cnDomains[c] + ',DIRECT')
  }

  // 端口直连（NTP / STUN 通用端口；个人端口在顶部自定义区维护）
  var directPorts = [123, 3478, 3479]
  for (var p = 0; p < directPorts.length; p++) {
    R.push('DST-PORT,' + directPorts[p] + ',DIRECT')
  }

  // 基础分流
  // 注：GEOSITE,cn 与 RULE-SET,cn_sites 数据同源（MetaCubeX geosite），仅保留后者；
  //     GEOIP,CN 已前移至局域网规则之后
  R.push('RULE-SET,gfw,节点选择')
  R.push('RULE-SET,cn_sites,国内直连')
  R.push('RULE-SET,proxy_sites,节点选择')

  // 最终匹配
  R.push('MATCH,漏网之鱼')

  log('[' + VERSION + '] Injected ' + R.length + ' rules')
}

// ---- 主函数 ----

function main(config) {
  try {
    if (!config || typeof config !== 'object') return config
    if (!Array.isArray(config.proxies) || config.proxies.length === 0) return config
    log('[' + VERSION + '] Start processing, ' + config.proxies.length + ' proxies')

    if (!Array.isArray(config['proxy-groups'])) config['proxy-groups'] = []
    if (!Array.isArray(config.rules)) config.rules = []

    overwriteGeneral(config)
    cleanupSubscription(config)
    var c = classifyAllNodes(config.proxies)
    log('[' + VERSION + '] Valid proxies: ' + c.ALL.length + ' (filtered from ' + config.proxies.length + ' total)')
    buildProxyGroups(config, c)
    injectRuleProviders(config)
    injectRules(config)
    log('[' + VERSION + '] Done — ' + config['proxy-groups'].length + ' groups, ' + Object.keys(config['rule-providers']).length + ' rule-providers, ' + config.rules.length + ' rules')
  } catch (e) {
    log('[' + VERSION + '] ERROR: ' + e.message)
  }
  return config
}

if (typeof globalThis !== 'undefined') globalThis.main = main
