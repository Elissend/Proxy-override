# ProxyOverride — 通用代理覆写配置

适用于 FlClash / Mihomo 的策略组分流规则。

[![Version](https://img.shields.io/badge/version-v3.0-blue)](https://github.com/Elissend/Proxy-override/releases)

> **本脚本会不定期更新规则和修复问题，请定期检查并更新到最新版本。**

## 目录

- [快速开始](#快速开始)
- [DNS 技术细节](#dns-技术细节)
- [策略组](#策略组)
- [规则覆盖](#规则覆盖)
- [节点分类逻辑](#节点分类逻辑)
- [覆盖范围](#覆盖范围)
- [自定义](#自定义)
- [常见问题](#常见问题)

## 快速开始

### JS 覆写版（推荐，支持节点过滤）

FLClash 用户推荐此版本——通过 JS 脚本动态过滤信息节点、按实际节点数量构建策略组。

**第 1 步：导入脚本**

FLClash → 工具 → 进阶设置 → 脚本 → 右上角 + → 右上角菜单 → 外部获取 → 通过 URL 导入：

```
https://raw.githubusercontent.com/Elissend/Proxy-override/main/proxy-override.js
```

**第 2 步：关联到订阅**

FLClash → 配置 → 点击机场订阅右侧菜单 → 更多 → 覆写 → 勾选脚本 → 返回，下拉刷新订阅。

**第 3 步：验证**

- 策略组是否出现节点选择 / AI 服务等
- 自动选择是否包含订阅节点
- DNS 查询日志中是否出现 `tls://` 或 `https://` 前缀

### YAML 配置版（独立使用，免脚本）

适用于 Clash Verge Rev / Mihomo Party 等非 FLClash 客户端。

**第 1 步：下载配置文件**

```
https://raw.githubusercontent.com/Sgraqwq/Proxy-override/main/proxy-override.yaml
```

**第 2 步：编辑订阅地址**

打开 `proxy-override.yaml`，将 `sub.url` 替换为你的机场订阅链接：

```yaml
proxy-providers:
  sub:
    type: http
    url: "https://你的机场订阅链接"
```

**第 3 步：加载配置**

- Clash Verge Rev：配置 → 新建 → 粘贴 YAML → 保存
- Mihomo Party：配置 → 导入 → 选择 proxy-override.yaml
- ShellCrash / OpenWrt：放置到 `/etc/mihomo/config.yaml` → 重启服务

**第 4 步：验证**

- 策略组是否正确加载
- 自动选择是否包含订阅节点
- 规则集文件是否下载到 `./ruleset/` 目录

> YAML 版的 proxy-provider 无法像 JS 覆写版那样用正则过滤信息节点（Mihomo RE2 正则引擎不支持负向排除）。如果订阅含大量信息节点，建议使用 JS 覆写版。



## DNS 技术细节

### 全链路加密

| 角色 | 服务器 | 协议 | 说明 |
|------|--------|------|------|
| Bootstrap | `tls://223.5.5.5` `tls://223.6.6.6` | DoT | 解析 DoH 域名自身 IP，阿里 DNS 国内低延迟 |
| 代理节点解析 | `https://doh.pub/dns-query` `tls://223.5.5.5` | DoH / DoT | 解析机场节点域名，国内 DNS 避免循环依赖 |
| 直连流量 | `https://dns.alidns.com/dns-query` | DoH | 国内域名解析走阿里 DoH |
| 国外兜底 | Cloudflare + Google | DoH | 未命中 policy 的域名走代理发出 |

无 UDP 53 明文，全部 DNS 查询经 TLS 加密传输。

### Fake-IP 模式

- 代理域名返回 `198.18.x.x` 虚拟 IP，请求进入规则引擎后通过域名匹配规则
- 排除名单覆盖局域网、NTP、STUN/WebRTC、远程工具、QQ 登录、移动认证、B站 CDN、国服战网
- 直连域名通过 `direct-nameserver` 解析真实 IP

### DNS 查询链路

```
国内域名：fake-ip → nameserver-policy 匹配 geosite:cn → 阿里/腾讯 DoH
国外域名：fake-ip → 未命中 policy → Cloudflare/Google DoH
节点域名：proxy-server-nameserver → DNSPod DoH/DoT（独立通道，避免循环依赖）
aistudio.google.com → 单独走国外 DoH（防止国内 DNS 污染）
```

## 策略组

### 基础设施组

| 组 | 类型 | 行为 |
|----|------|------|
| 节点选择 | select | 手动选择入口，默认指向自动选择 |
| 自动选择 | url-test | 300s 测速 gstatic.com/generate_204，延迟最低胜出，tolerance=150ms |
| 故障转移 | fallback | 按序尝试，首个可用即为选中，300s 重检 |

### 业务策略组

| 组 | 默认策略 | 可用选项 |
|----|----------|----------|
| AI | 节点选择 | 全部节点 + DIRECT |
| YouTube | 节点选择 | 全部节点 + DIRECT |
| Telegram | 节点选择 | 全部节点 + DIRECT |
| 海外社交 | 节点选择 | 全部节点 + DIRECT |
| 流媒体 | 节点选择 | 全部节点 + DIRECT |
| Google | 节点选择 | 全部节点 + DIRECT |
| 开发工具 | 节点选择 | 全部节点 + DIRECT |
| 海外游戏 | 节点选择 | 全部节点 + DIRECT |
| 苹果 | DIRECT | DIRECT + 全部节点 |
| 微软 | DIRECT | DIRECT + 全部节点 |
| 国内直连 | DIRECT | DIRECT |
| 广告拦截 | REJECT | REJECT / DIRECT |
| 漏网之鱼 | 节点选择 | 全部节点 + DIRECT + REJECT |

每个业务组独立列出所有订阅节点，无需跳转即可直选任意节点。

### 选型说明

- url-test 适合日常使用（自动选最快），fallback 适合需要稳定单一出口的场景
- 流媒体不走 url-test：部分平台检测 IP 频繁切换，手动锁定节点更稳定
- 漏网之鱼包含 REJECT：排查规则遗漏时可临时 REJECT 未匹配流量，观察日志定位新域名

## 规则覆盖

### 远程规则集（JS/YAML 版 9 个 MRS）

| 规则集 | 来源 | 更新间隔 |
|--------|------|----------|
| `anti-ad` | DustinWin/ruleset_geodata | ~23.7h |
| `openai` | MetaCubeX/meta-rules-dat | ~23.8h |
| `tiktok` | MetaCubeX/meta-rules-dat | ~23.8h |
| `github` | MetaCubeX/meta-rules-dat | ~23.8h |
| `microsoft` | MetaCubeX/meta-rules-dat | ~23.8h |
| `apple` | MetaCubeX/meta-rules-dat | ~23.8h |
| `proxy_sites` | MetaCubeX/meta-rules-dat (geolocation-!cn) | ~24h |
| `cn_sites` | MetaCubeX/meta-rules-dat (cn) | ~24h |
| `gfw` | MetaCubeX/meta-rules-dat (gfw) | ~24h |

所有规则集通过 `fastly.jsdelivr.net` CDN 分发，间隔错开避免同时更新。

### 内置域名规则

| 类别 | 典型规则 |
|------|----------|
| 广告拦截 | category-ads-all + anti-ad 规则集 |
| anti-ad 白名单 | 微信小程序 / 火山引擎 APM / 极光推送 / 友盟 / 归因 SDK / 公共 CDN |
| QUIC 阻断 | 微软/苹果/YouTube/Google 豁免，其余非中国站点 REJECT |
| 局域网 | private / localhost / local |
| 进程直连 | 微信、QQ、远程桌面、Tailscale、frpc 等 |
| 前置拦截 | jsdelivr.net / dns.google 确保走代理 |
| YouTube | GEOSITE youtube（youtube.com / googlevideo.com / ytimg.com 等） |
| AI 服务 | OpenAI / Claude / Gemini / Perplexity / Cursor / HuggingFace 等 |
| Telegram | GEOSITE telegram（telegram.org / t.me / telegram.me 等） |
| 海外社交 | Twitter / Facebook / Instagram / Pixiv 等 + snapchat 硬编码 |
| 流媒体 | Netflix / Spotify / Disney / TikTok 等 + 4 项硬编码 |
| 游戏平台 | 国服直连 / 海外走代理（Steam / Epic / Blizzard 等） |
| 开发工具 | GitHub / Docker / JetBrains / npm / PyPI / Vercel 等 |
| 苹果/微软 | 规则集覆盖 + icloud.com / storeedge 强制直连 |
| 国内直连 | 百度 / 阿里 / 腾讯 / 字节等 |
| 端口直连 | NTP 123 / STUN 3478-3479 等 |
| 基础分流 | GFW / cn_sites / GEOSITE:cn / proxy_sites / GEOIP CN |
| 兜底 | MATCH 漏网之鱼 |

### 规则优先级

```
REJECT（广告/QUIC） → DIRECT（局域网/进程） → 业务分组 → 规则集分流 → GEOIP CN → MATCH
```

`googleapis.com` 通配规则排在 AI 专属子域名之后，避免遮蔽。

## 节点分类逻辑

覆写脚本接管订阅的所有代理节点，过滤信息节点后动态构建策略组：

```
config.proxies（订阅原始节点列表）
  │
  ├─ 过滤：排除名称中含「剩余/到期/套餐/流量/官网/免费/试用」等信息节点
  │
  └─ 有效节点
       │
       ├─ 自动选择 (url-test) ← 全量节点
       ├─ 故障转移 (fallback) ← 全量节点
       ├─ 节点选择 (select)   ← 自动选择 + 故障转移 + 全量节点 + DIRECT
       └─ 所有业务组          ← 节点选择 + 自动选择 + 故障转移 + 全量节点 + DIRECT
```

## 覆盖范围

脚本会完全替换订阅自带的以下内容：

- `proxy-groups` — 清空后重建
- `rules` — 清空后重建
- `rule-providers` — 清空后重建
- `dns` — 完全覆写
- `sniffer` — 完全覆写
- `profile` — 覆写
- `geox-url` — 覆写

订阅的 `proxies` 节点列表不受影响。

## 自定义

### 添加需要过滤的节点关键词

编辑 `isInfoNode` 函数中的正则表达式：

```js
function isInfoNode(name) {
  return /(你的关键词1|你的关键词2|...)/i.test(name)
}
```

### 调整 url-test 参数

```js
upsertGroup(config, {
  name: '自动选择', type: 'url-test',
  url: 'http://www.gstatic.com/generate_204',
  interval: 300,    // 测速间隔（秒）
  tolerance: 150,   // 切换阈值（毫秒）
  lazy: true,
  proxies: allNodes.slice()
})
```

## 常见问题

### 某个服务走了错误的线路

FLClash → 配置 → 点击订阅 → 日志 → 搜索目标域名 → 确认匹配的规则及顺序。

### 如何更新覆写脚本

FLClash → 工具 → 进阶设置 → 脚本 → 点击脚本 → 右上角菜单 → 外部获取 → 重新通过 URL 导入 → 下拉刷新订阅。
