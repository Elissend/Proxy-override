// FlClash 覆写脚本
// 版本：v2.0 (2026-05-18)
// 架构：3 基础设施组 + 9 业务策略组 + 9 rule-providers + 全加密 DNS
// 适用：FlClash >= v0.8.85；任何机场订阅
//
// === 导入方法（FlClash，两步操作） ===
//
// 【第 1 步：创建覆写脚本】
//   FlClash → 配置 →「覆写脚本」→ 右上角 + → 粘贴本文件全部内容 → 保存
//
// 【第 2 步：关联到订阅】
//   配置页 → 订阅卡片 ⋮ →「更多」→「覆写」→ 点选刚才创建的脚本 → 确定 → 下拉刷新
//
// ================================================================

const VERSION = 'v2.0'

// FlClash JS 引擎环境兼容
var log = (typeof console !== 'undefined' && console.log) ? console.log.bind(console) : function() {}

// ================================================================
//  模块 A：全局参数 / DNS / Sniffer 覆写
// ================================================================

function overwriteGeneral(config) {
  config['unified-delay'] = true
  config['tcp-concurrent'] = true
  config['find-process-mode'] = 'strict'
  config['keep-alive-idle'] = 30
  config['keep-alive-interval'] = 15

  if (!config.profile) config.profile = {}
  config.profile['store-selected'] = true
  config.profile['store-fake-ip'] = false

  config['geox-url'] = {
    geosite: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat',
    geoip: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat'
  }

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
      'Mijia Cloud',
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
      '+.lan', '+.local', '+.localhost', '+.direct',
      '+.msftconnecttest.com', '+.msftncsi.com',
      '+.baidu.com', '+.bilibili.com', '+.bing.com', '+.chiphell.com',
      '+.oray.com', '+.sunlogin.com', '+.todesk.com', '+.rustdesk.com',
      '+.teamviewer.com', '+.anydesk.com', '+.tailscale.com', '+.zerotier.com', '+.nvidia.com',
      '+.ntp.org', '+.pool.ntp.org',
      'time.*.com', 'ntp.*.com', 'time.*.gov', 'time.*.apple.com', 'time.windows.com', 'time.nist.gov',
      '+.stun.*', '+.stun.*.*', '+.stun.*.*.*', 'stun.*',
      'ip.cip.cc',
      'captive.apple.com', 'connectivitycheck.gstatic.com', 'id6.me',
      'localhost.ptlogin2.qq.com',
      '+.cmpassport.com',
      '+.mcdn.bilivideo.cn',
      '+.battlenet.com.cn', '+.wotgame.cn', '+.wggames.cn', '+.wowsgame.cn',
    ],
    'default-nameserver': ['tls://223.5.5.5', 'tls://223.6.6.6'],
    'proxy-server-nameserver': ['https://doh.pub/dns-query', 'tls://223.5.5.5'],
    'direct-nameserver': ['https://dns.alidns.com/dns-query'],
    'nameserver-policy': {
      'geosite:cn,geolocation-cn,bilibili,biliintl': [
        'https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query',
        'tls://223.5.5.5', 'tls://223.6.6.6'
      ],
      'aistudio.google.com': ['https://dns.cloudflare.com/dns-query', 'https://dns.google/dns-query']
    },
    nameserver: ['https://dns.cloudflare.com/dns-query', 'https://dns.google/dns-query'],
    'respect-rules': true,
    'direct-nameserver-follow-policy': true
  }
}

// ================================================================
//  模块 B：判断是否为信息/过期节点
// ================================================================

function isInfoNode(name) {
  if (!name || typeof name !== 'string') return true
  return /(剩余|到期|官网|套餐|流量|网址|地址|过期|重置|更新|应急|免费|试用|Sign|Login|Register|Help|FAQ|客服|联系|网站)/i.test(name)
}

// ================================================================
//  模块 C：节点分类
// ================================================================

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

// ================================================================
//  模块 D：策略组创建
// ================================================================

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

  upsertGroup(config, {
    name: '节点选择', type: 'select',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Manual.png',
    proxies: ['自动选择', '故障转移'].concat(allNodes).concat(['DIRECT'])
  })

  upsertGroup(config, {
    name: '自动选择', type: 'url-test',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Auto.png',
    url: 'http://www.gstatic.com/generate_204',
    interval: 300, tolerance: 150, lazy: true,
    proxies: allNodes.slice()
  })

  upsertGroup(config, {
    name: '故障转移', type: 'fallback',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Round_Robin.png',
    url: 'http://www.gstatic.com/generate_204',
    interval: 300, lazy: true,
    proxies: allNodes.slice()
  })

  // 业务策略组 — 节点选择排最前，后面跟全部节点
  var bizGroup = ['节点选择', '自动选择', '故障转移'].concat(allNodes).concat(['DIRECT'])

  upsertGroup(config, { name: 'AI 服务',   type: 'select', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Bot.png', proxies: bizGroup.slice() })
  upsertGroup(config, { name: 'YouTube',   type: 'select', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/YouTube.png', proxies: bizGroup.slice() })
  upsertGroup(config, { name: 'Telegram',  type: 'select', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Telegram.png', proxies: bizGroup.slice() })
  upsertGroup(config, { name: '流媒体',    type: 'select', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/ForeignMedia.png', proxies: bizGroup.slice() })

  var appleGroup = ['DIRECT', '节点选择', '自动选择', '故障转移'].concat(allNodes)
  upsertGroup(config, { name: '苹果服务', type: 'select', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Apple.png', proxies: appleGroup.slice() })
  upsertGroup(config, { name: '微软服务', type: 'select', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Microsoft.png', proxies: appleGroup.slice() })

  upsertGroup(config, { name: '国内直连', type: 'select', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Direct.png', proxies: ['DIRECT'] })
  upsertGroup(config, { name: '广告拦截', type: 'select', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/AdBlack.png', proxies: ['REJECT', 'DIRECT'] })

  var finalGroup = ['节点选择', '自动选择', '故障转移'].concat(allNodes).concat(['DIRECT', 'REJECT'])
  upsertGroup(config, { name: '漏网之鱼', type: 'select', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Available.png', proxies: finalGroup.slice() })
}

// ================================================================
//  模块 E：清理订阅自带旧组和旧规则
// ================================================================

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

// ================================================================
//  模块 F：远程规则集
// ================================================================

function injectRuleProviders(config) {
  if (!config['rule-providers']) config['rule-providers'] = {}

  var RP = config['rule-providers']

  RP['anti-ad'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: 'https://fastly.jsdelivr.net/gh/DustinWin/ruleset_geodata@mihomo-ruleset/ads.mrs',
    path: './ruleset/anti-ad.mrs', interval: 85515, proxy: 'DIRECT' }

  RP['openai'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/openai.mrs',
    path: './ruleset/meta-openai.mrs', interval: 85530, proxy: 'AI 服务' }

  RP['tiktok'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/tiktok.mrs',
    path: './ruleset/meta-tiktok.mrs', interval: 85575, proxy: '流媒体' }

  RP['github'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/github.mrs',
    path: './ruleset/meta-github.mrs', interval: 85635, proxy: 'DIRECT' }

  RP['microsoft'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/microsoft.mrs',
    path: './ruleset/meta-microsoft.mrs', interval: 85650, proxy: '微软服务' }

  RP['apple'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/apple.mrs',
    path: './ruleset/meta-apple.mrs', interval: 85665, proxy: '苹果服务' }

  RP['proxy_sites'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/geolocation-!cn.mrs',
    path: './ruleset/proxy_sites.mrs', interval: 86415, proxy: 'DIRECT' }

  RP['cn_sites'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/cn.mrs',
    path: './ruleset/cn_sites.mrs', interval: 86430, proxy: 'DIRECT' }

  RP['gfw'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/gfw.mrs',
    path: './ruleset/meta-gfw.mrs', interval: 86445, proxy: 'DIRECT' }

  log('[' + VERSION + '] Injected ' + Object.keys(RP).length + ' rule-providers')
}

// ================================================================
//  模块 G：分流规则
// ================================================================

function injectRules(config) {
  var R = config.rules

  // 广告拦截
  R.push('GEOSITE,category-ads-all,广告拦截')
  R.push('RULE-SET,anti-ad,广告拦截')

  // QUIC 阻断
  R.push('AND,((DST-PORT,443),(NETWORK,UDP),(RULE-SET,microsoft)),微软服务')
  R.push('AND,((DST-PORT,443),(NETWORK,UDP),(RULE-SET,apple)),苹果服务')
  R.push('AND,((DST-PORT,443),(NETWORK,UDP),(NOT,((RULE-SET,cn_sites)))),REJECT')

  // 局域网 / 私有网络
  R.push('DST-PORT,7680,REJECT')
  R.push('GEOSITE,private,DIRECT')
  R.push('GEOIP,private,DIRECT,no-resolve')
  R.push('DOMAIN,localhost,DIRECT')
  R.push('DOMAIN-SUFFIX,local,DIRECT')

  // 进程名直连（仅 Windows 平台生效；其他平台静默跳过，流量由后续规则接管）
  var localProcesses = [
    'WinStore.App.exe', 'WinStore.Mobile.exe',
    'Weixin.exe', 'WeChat.exe', 'WeChatAppEx.exe', 'QQ.exe',
    'SunloginClient.exe', 'ToDesk.exe', 'ToDesk_Service.exe', 'rustdesk.exe',
    'TeamViewer.exe', 'AnyDesk.exe', 'tailscale.exe', 'tailscaled.exe',
    'frpc.exe', 'Navicat.exe', 'cloudflared.exe'
  ]
  for (var i = 0; i < localProcesses.length; i++) {
    R.push('PROCESS-NAME,' + localProcesses[i] + ',DIRECT')
  }

  // 前置拦截
  R.push('DOMAIN-SUFFIX,jsdelivr.net,节点选择')
  R.push('DOMAIN,dns.google,节点选择')
  R.push('DOMAIN,dns.google.com,节点选择')

  // YouTube
  R.push('DOMAIN-SUFFIX,youtube.com,YouTube')
  R.push('DOMAIN-SUFFIX,youtu.be,YouTube')
  R.push('DOMAIN-SUFFIX,googlevideo.com,YouTube')
  R.push('DOMAIN-SUFFIX,ytimg.com,YouTube')
  R.push('DOMAIN-SUFFIX,ggpht.com,YouTube')

  // AI 服务
  R.push('RULE-SET,openai,AI 服务')
  var aiDomains = [
    'chatgpt.com', 'oaistatic.com', 'oaiusercontent.com', 'sora.com',
    'claude.ai', 'anthropic.com',
    'ai.google.dev', 'generativelanguage.googleapis.com',
    'mistral.ai', 'perplexity.ai', 'cohere.ai', 'cohere.com',
    'midjourney.com', 'stability.ai',
    'cursor.com', 'cursor.sh', 'huggingface.co', 'replicate.com',
    'together.ai', 'suno.ai', 'suno.com', 'openrouter.ai', 'runpod.io',
    'x.ai', 'grok.com', 'copilot.microsoft.com'
  ]
  for (var j = 0; j < aiDomains.length; j++) {
    R.push('DOMAIN-SUFFIX,' + aiDomains[j] + ',AI 服务')
  }

  // Google 服务（放在 AI 之后，避免遮蔽特定 API 子域名）
  R.push('DOMAIN-SUFFIX,gstatic.com,节点选择')
  R.push('DOMAIN-SUFFIX,googleapis.com,节点选择')

  // DeepSeek 国内直连
  R.push('DOMAIN-SUFFIX,deepseek.com,国内直连')

  // Telegram
  R.push('DOMAIN-SUFFIX,telegram.org,Telegram')
  R.push('DOMAIN-SUFFIX,telegram.me,Telegram')
  R.push('DOMAIN-SUFFIX,t.me,Telegram')

  // 海外社交
  var socialDomains = [
    'twitter.com', 'twimg.com', 't.co', 'x.com',
    'reddit.com', 'redd.it',
    'facebook.com', 'fbcdn.net', 'instagram.com', 'cdninstagram.com',
    'linkedin.com', 'licdn.com',
    'snapchat.com', 'pinterest.com', 'threads.net',
    'bsky.app', 'bsky.social',
    'quora.com', 'medium.com', 'imgur.com', 'flickr.com', 'tumblr.com',
    'pixiv.net', 'pximg.net'
  ]
  for (var k = 0; k < socialDomains.length; k++) {
    R.push('DOMAIN-SUFFIX,' + socialDomains[k] + ',节点选择')
  }

  // 字节海外专属
  var bytedanceOverseas = [
    'byteoversea.com', 'byteoversea.net', 'ibytedtos.com', 'ibyteimg.com',
    'byteglb.com', 'larksuite.com', 'lark.com', 'pangle.io', 'volces.com'
  ]
  for (var i = 0; i < bytedanceOverseas.length; i++) {
    R.push('DOMAIN-SUFFIX,' + bytedanceOverseas[i] + ',节点选择')
  }

  // 流媒体
  R.push('RULE-SET,tiktok,流媒体')

  var streamDomains = [
    'netflix.com', 'nflxvideo.net', 'nflxext.com',
    'spotify.com', 'scdn.co', 'spotifycdn.com',
    'hulu.com', 'hbomax.com', 'max.com',
    'disneyplus.com', 'bamgrid.com',
    'primevideo.com', 'amazonprime.com', 'twitch.tv',
    'discoveryplus.com', 'paramountplus.com', 'peacocktv.com',
    'vimeo.com', 'dailymotion.com', 'crunchyroll.com'
  ]
  for (var s = 0; s < streamDomains.length; s++) {
    R.push('DOMAIN-SUFFIX,' + streamDomains[s] + ',流媒体')
  }

  // 游戏平台
  var gameDomains = [
    'steampowered.com', 'steamcommunity.com', 'steamcdn-a.akamaihd.net',
    'epicgames.com', 'ea.com', 'origin.com',
    'ubisoft.com', 'ubi.com',
    'riotgames.com', 'leagueoflegends.com',
    'blizzard.com', 'battle.net',
    'nintendo.com', 'playstation.com', 'xbox.com', 'xboxlive.com',
    'hoyoverse.com', 'hoyolab.com',
    'gog.com', 'rockstargames.com'
  ]
  for (var g = 0; g < gameDomains.length; g++) {
    R.push('DOMAIN-SUFFIX,' + gameDomains[g] + ',节点选择')
  }

  // 开发工具
  R.push('RULE-SET,github,节点选择')
  var devDomains = [
    'ghcr.io', 'github.io',
    'docker.io', 'docker.com',
    'repo.maven.apache.org', 'maven.apache.org',
    'jetbrains.com', 'jetbrains.space', 'jetbrains.net',
    'npmjs.org', 'npmjs.com', 'yarnpkg.com',
    'pypi.org', 'pythonhosted.org',
    'crates.io', 'rubygems.org', 'nuget.org', 'packagist.org',
    'stackoverflow.com', 'stackexchange.com',
    'vercel.com', 'vercel.app', 'netlify.com', 'netlify.app',
    'pages.dev', 'workers.dev',
    'gitlab.com', 'bitbucket.org',
    'digitalocean.com', 'vultr.com', 'heroku.com', 'fly.io', 'render.com',
    'sentry.io', 'postman.com', 'notion.so', 'figma.com',
    'atlassian.com', 'hashicorp.com', 'terraform.io'
  ]
  for (var d = 0; d < devDomains.length; d++) {
    R.push('DOMAIN-SUFFIX,' + devDomains[d] + ',节点选择')
  }
  R.push('GEOSITE,category-dev,节点选择')

  // 苹果服务
  R.push('DOMAIN-SUFFIX,icloud.com,DIRECT')
  R.push('RULE-SET,apple,苹果服务')
  R.push('DOMAIN-SUFFIX,apple.com.cn,苹果服务')
  R.push('DOMAIN-SUFFIX,icloud.com.cn,苹果服务')
  R.push('DOMAIN-SUFFIX,mzstatic.com,苹果服务')

  // 微软服务
  R.push('DOMAIN-SUFFIX,storeedge.microsoft.com,DIRECT')
  R.push('DOMAIN-SUFFIX,mp.microsoft.com,DIRECT')
  R.push('RULE-SET,microsoft,微软服务')
  R.push('DOMAIN-SUFFIX,microsoft.cn,微软服务')
  R.push('DOMAIN-SUFFIX,msftconnecttest.com,微软服务')
  R.push('DOMAIN-SUFFIX,msn.com,微软服务')
  R.push('DOMAIN-SUFFIX,live.com,微软服务')
  R.push('DOMAIN-SUFFIX,sfx.ms,微软服务')

  // 国内直连
  var cnDomains = [
    'baidu.com', 'bdstatic.com', 'bilibili.com',
    'alicdn.com', 'alipay.com', 'taobao.com', 'aliyuncs.com',
    'qcloud.com', 'myqcloud.com',
    'feishu.cn', 'dingtalk.com',
    '163.com', '126.com', '126.net', 'chiphell.com'
  ]
  for (var c = 0; c < cnDomains.length; c++) {
    R.push('DOMAIN-SUFFIX,' + cnDomains[c] + ',DIRECT')
  }

  // 端口直连
  var directPorts = [123, 3478, 3479, 33068, 6540, 26880]
  for (var p = 0; p < directPorts.length; p++) {
    R.push('DST-PORT,' + directPorts[p] + ',DIRECT')
  }

  // Google .cn 防误伤
  R.push('DOMAIN-SUFFIX,services.googleapis.cn,节点选择')
  R.push('DOMAIN-SUFFIX,googleapis.cn,节点选择')

  // 基础分流
  R.push('RULE-SET,gfw,节点选择')
  R.push('RULE-SET,cn_sites,国内直连')
  R.push('RULE-SET,proxy_sites,节点选择')
  R.push('GEOIP,CN,国内直连,no-resolve')

  // 最终匹配
  R.push('MATCH,漏网之鱼')

  log('[' + VERSION + '] Injected ' + R.length + ' rules')
}

// ================================================================
//  主函数
// ================================================================

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
