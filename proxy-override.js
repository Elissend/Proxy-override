// FlClash 覆写脚本
// 版本：v3.0 (2026-05-21)
// 架构：3 基础设施组 + 13 业务策略组 + 9 rule-providers + 全加密 DNS
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

const VERSION = 'v3.0'

// FlClash JS 引擎环境兼容
var log = (typeof console !== 'undefined' && console.log) ? console.log.bind(console) : function() {}

// CDN 基地址——所有远程规则集 / GeoX 数据共用
// 中国大陆用户遇到下载失败可尝试替换为以下任一镜像：
//   testingcf.jsdelivr.net — Cloudflare CDN
//   gcore.jsdelivr.net     — Gcore CDN
const CDN_BASE = 'https://fastly.jsdelivr.net'

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
    geosite: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@release/geosite.dat',
    geoip: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@release/geoip.dat'
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
      '+.lan', '+.local', '+.localhost', '+.direct',
      '+.msftconnecttest.com', '+.msftncsi.com',
      '+.baidu.com', '+.bilibili.com', '+.bing.com', '+.chiphell.com',
      '+.oray.com', '+.sunlogin.com', '+.todesk.com', '+.rustdesk.com',
      '+.teamviewer.com', '+.anydesk.com', '+.tailscale.com', '+.zerotier.com', '+.nvidia.com',
      '+.ntp.org', '+.pool.ntp.org',
      '+.time.apple.com', '+.time.google.com', '+.time.nist.gov', 'time.windows.com',
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
    url: CDN_BASE + '/gh/DustinWin/ruleset_geodata@mihomo-ruleset/ads.mrs',
    path: './ruleset/anti-ad.mrs', interval: 85515, proxy: 'DIRECT' }

  RP['openai'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/openai.mrs',
    path: './ruleset/meta-openai.mrs', interval: 85530, proxy: 'AI' }

  RP['tiktok'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/tiktok.mrs',
    path: './ruleset/meta-tiktok.mrs', interval: 85575, proxy: '流媒体' }

  RP['github'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/github.mrs',
    path: './ruleset/meta-github.mrs', interval: 85635, proxy: 'DIRECT' }

  RP['microsoft'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/microsoft.mrs',
    path: './ruleset/meta-microsoft.mrs', interval: 85650, proxy: '微软' }

  RP['apple'] = { type: 'http', behavior: 'domain', format: 'mrs',
    url: CDN_BASE + '/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/apple.mrs',
    path: './ruleset/meta-apple.mrs', interval: 85665, proxy: '苹果' }

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

// ================================================================
//  模块 G：分流规则
// ================================================================

function injectRules(config) {
  var R = config.rules

  // 微信小程序基础设施（anti-ad 规则集可能误伤 *.wxs.qq.com 等子域名，优先放行）
  R.push('DOMAIN-SUFFIX,wxs.qq.com,DIRECT')
  R.push('DOMAIN-SUFFIX,wx.qlogo.cn,DIRECT')
  R.push('DOMAIN-SUFFIX,servicewechat.com,DIRECT')
  R.push('DOMAIN-SUFFIX,mp.weixin.qq.com,DIRECT')
  R.push('DOMAIN,school-wx.qshnhealth.com,DIRECT')

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

  // 广告拦截
  R.push('GEOSITE,category-ads-all,广告拦截')
  R.push('RULE-SET,anti-ad,广告拦截')

  // QUIC 阻断（微软/苹果/YouTube/Google 豁免，其余非中国站点 REJECT）
  R.push('AND,((DST-PORT,443),(NETWORK,UDP),(RULE-SET,microsoft)),微软')
  R.push('AND,((DST-PORT,443),(NETWORK,UDP),(RULE-SET,apple)),苹果')
  R.push('AND,((DST-PORT,443),(NETWORK,UDP),(GEOSITE,youtube)),YouTube')
  R.push('AND,((DST-PORT,443),(NETWORK,UDP),(GEOSITE,google)),Google')
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
  R.push('GEOSITE,youtube,YouTube')

  // AI
  R.push('RULE-SET,openai,AI')
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
    R.push('DOMAIN-SUFFIX,' + aiDomains[j] + ',AI')
  }

  // Google 服务（放在 AI 之后，避免遮蔽特定 API 子域名）
  R.push('DOMAIN-SUFFIX,gstatic.com,Google')
  R.push('DOMAIN-SUFFIX,googleapis.com,Google')

  // DeepSeek 国内直连
  R.push('DOMAIN-SUFFIX,deepseek.com,国内直连')

  // Telegram
  R.push('GEOSITE,telegram,Telegram')

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
  // 注：volces.com 的 apmplus / mssdk 子域名已在 anti-ad 前单独处理（DIRECT），
  // 此处 DOMAIN-SUFFIX 规则对 volces.com 其余子域名生效（走代理）
  var bytedanceOverseas = [
    'byteoversea.com', 'byteoversea.net', 'ibytedtos.com', 'ibyteimg.com',
    'byteglb.com', 'larksuite.com', 'lark.com', 'pangle.io', 'volces.com'
  ]
  for (var i = 0; i < bytedanceOverseas.length; i++) {
    R.push('DOMAIN-SUFFIX,' + bytedanceOverseas[i] + ',节点选择')
  }

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
  R.push('RULE-SET,github,开发工具')
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
    R.push('DOMAIN-SUFFIX,' + devDomains[d] + ',开发工具')
  }
  // Fedora 镜像直连（Metalink 根据来源 IP 自动分配国内镜像）
  R.push('DOMAIN-SUFFIX,fedoraproject.org,DIRECT')
  // AlmaLinux 镜像列表被 GFW 阻断，走代理
  R.push('DOMAIN-SUFFIX,almalinux.org,开发工具')
  // Fermilab 镜像（AlmaLinux 默认仓库，美国服务器）
  R.push('DOMAIN-SUFFIX,linux-mirrors.fnal.gov,开发工具')
  R.push('GEOSITE,category-dev,开发工具')

  // 苹果
  R.push('DOMAIN-SUFFIX,icloud.com,DIRECT')
  R.push('RULE-SET,apple,苹果')
  R.push('DOMAIN-SUFFIX,apple.com.cn,苹果')
  R.push('DOMAIN-SUFFIX,icloud.com.cn,苹果')
  R.push('DOMAIN-SUFFIX,mzstatic.com,苹果')

  // 微软
  R.push('DOMAIN-SUFFIX,storeedge.microsoft.com,DIRECT')
  R.push('DOMAIN-SUFFIX,mp.microsoft.com,DIRECT')
  R.push('RULE-SET,microsoft,微软')
  R.push('DOMAIN-SUFFIX,microsoft.cn,微软')
  R.push('DOMAIN-SUFFIX,msftconnecttest.com,微软')
  R.push('DOMAIN-SUFFIX,msn.com,微软')
  R.push('DOMAIN-SUFFIX,live.com,微软')
  R.push('DOMAIN-SUFFIX,sfx.ms,微软')

  // 国内直连
  var cnDomains = [
    'baidu.com', 'bdstatic.com', 'bilibili.com',
    'alicdn.com', 'alipay.com', 'taobao.com', 'aliyuncs.com',
    'qcloud.com', 'myqcloud.com',
    'feishu.cn', 'dingtalk.com',
    '163.com', '126.com', '126.net', 'chiphell.com',
    'xindazhilian.com',
    'halo.run'
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
  R.push('DOMAIN-SUFFIX,services.googleapis.cn,Google')
  R.push('DOMAIN-SUFFIX,googleapis.cn,Google')

  // 基础分流
  R.push('RULE-SET,gfw,节点选择')
  R.push('RULE-SET,cn_sites,国内直连')
  R.push('GEOSITE,cn,国内直连')
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
