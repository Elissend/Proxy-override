# ProxyOverride — 通用代理覆写配置

适用于 FlClash / Mihomo / Egern 的全加密 DNS、12 策略组分流规则，导入即用，零手动配置。

[![Version](https://img.shields.io/badge/version-v2.4-blue)](https://github.com/Sgraqwq/Proxy-override/releases)

> [!IMPORTANT]
> **本脚本会不定期更新规则和修复问题，请定期检查并更新到最新版本，以免分流规则过期或 Bug 未修复。**
> 建议每次机场订阅续费时顺手拉取一次最新版。

## 目录

- [快速开始](#快速开始)
  - [JS 覆写版（推荐，支持节点过滤）](#js-覆写版推荐支持节点过滤)
  - [YAML 配置版（独立使用，免脚本）](#yaml-配置版独立使用免脚本)
- [Egern 配置版（iOS）](#egern-配置版ios)
- [两种版本对比](#两种版本对比)
- [架构设计](#架构设计)
- [DNS 技术细节](#dns-技术细节)
- [策略组](#策略组)
- [规则覆盖](#规则覆盖)
- [节点分类逻辑](#节点分类逻辑)
- [覆盖范围](#覆盖范围)
- [自定义](#自定义)
- [常见问题](#常见问题)

## 快速开始

**前提**：FLClash ≥ v0.8.85（或任意 Mihomo 客户端），已导入机场订阅。

### JS 覆写版（推荐，支持节点过滤）

FLClash 用户推荐此版本——通过 JS 脚本动态过滤信息节点、按实际节点数量构建策略组。

FLClash → 右下角 **工具** → **进阶设置** → **脚本** → 右上角 **+** → 右上角 **⋮** → **外部获取** → **通过 URL 导入** → 粘贴以下地址：

```
https://raw.githubusercontent.com/Sgraqwq/Proxy-override/main/proxy-override.js
```

### 第 2 步：关联到订阅

FLClash → **配置** → 点击机场订阅右侧的 **⋮** → **更多** → **覆写** → 勾选刚才导入的脚本 → 返回，下拉刷新订阅。

### 第 3 步：验证

刷新后检查：

- 策略组是否出现 `🎯 节点选择` / `🤖 AI 服务` 等
- `⚡ 自动选择` 是否包含订阅节点
- DNS 查询日志中是否出现 `tls://` 或 `https://` 前缀
- GeoX 文件是否自动下载（`geosite.dat` / `geoip.dat`）

### YAML 配置版（独立使用，免脚本）

适用于 Clash Verge Rev / Mihomo Party 等非 FLClash 客户端，或以完整配置文件方式部署。

**第 1 步：下载 YAML 配置文件**

```
https://raw.githubusercontent.com/Sgraqwq/Proxy-override/main/proxy-override.yaml
```

**第 2 步：编辑订阅地址**

打开 `proxy-override.yaml`，找到 `proxy-providers` 段落，将 `sub.url` 替换为你的机场订阅链接：

```yaml
proxy-providers:
  sub:
    type: http
    url: "https://你的机场订阅链接"   # ← 替换这里
```

**第 3 步：加载配置**

- **Clash Verge Rev**：配置 → 新建 → 粘贴 YAML 内容 → 保存，也可直接导入文件
- **Mihomo Party**：配置 → 导入 → 选择 `proxy-override.yaml`
- **ShellCrash / OpenWrt**：将文件放置到 `/etc/mihomo/config.yaml` → 重启服务

**第 4 步：验证**

- 策略组是否正确加载（检查 `🎯 节点选择` / `🤖 AI 服务` 等）
- `⚡ 自动选择` 是否包含订阅节点
- 规则集文件是否下载到 `./ruleset/` 目录

> **注意**：YAML 版的 `proxy-provider` 无法像 JS 覆写版那样用正则过滤"剩余/到期/官网/免费"等信息节点（Mihomo RE2 正则引擎不支持负向排除）。如果订阅含大量信息节点，建议使用 JS 覆写版。

## Egern 配置版（iOS）

适用于 [Egern](https://egernapp.com) iOS 代理客户端。

| 文件 | 用途 |
|------|------|
| `egern-profile.yaml` | 完整配置，含规则 + 策略组 + DNS + 个人节点 |
| `egern-profile-native.yaml` | 纯净模板，无节点无凭证，可分享 |

**规则集来源**：[Centralmatrix3/Matrix-io](https://github.com/Centralmatrix3/Matrix-io) Egern 原生 YAML 格式。

**使用方法**：Egern → 配置 → 导入 → 选择对应 yaml 文件。

## 三种版本对比

| 特性 | JS 覆写版 | YAML 配置版 | Egern 版 |
|------|----------|------------|---------|
| 文件 | `proxy-override.js` | `proxy-override.yaml` | `egern-profile.yaml` |
| 适用客户端 | FLClash（推荐） | 所有 Mihomo 客户端 | Egern（iOS） |
| 节点来源 | 订阅 `proxies` 数组 | `proxy-provider` 拉取 | `external` 策略组 |
| 信息节点过滤 | ✅ 正则过滤 | ❌ YAML 无法实现 | ⚠️ `filter` 正则 |
| 策略组动态构建 | ✅ 按实际节点数 | ⚠️ 固定 `use` 引用 | ⚠️ `flatten` 展开 |
| 部署复杂度 | FLClash 两步骤 | 替换订阅链接即可 | 导入文件即可 |
| 自定义便捷度 | 编辑 JS 函数 | 编辑 YAML 字段 | 编辑 YAML 字段 |

**推荐**：FLClash 用户首选 JS 覆写版；其他 Mihomo 客户端使用 YAML 版；iOS 用户使用 Egern 版。

## 架构设计

```
请求 → 规则引擎（~180 条，顺序匹配）
         │
         ├─ 广告          → REJECT
         ├─ QUIC UDP      → REJECT（微软/苹果除外）
         ├─ 局域网/进程    → DIRECT
         ├─ YouTube       → 📹 YouTube  → 代理池
         ├─ AI API        → 🤖 AI 服务  → 代理池
         ├─ Telegram      → ✈️ Telegram → 代理池
         ├─ 流媒体         → 🎬 流媒体   → 代理池
         ├─ 游戏国服       → DIRECT
         ├─ 游戏海外       → 🎯 节点选择 → 代理池
         ├─ 海外社交/开发   → 🎯 节点选择 → 代理池
         ├─ 苹果/微软      → 默认 DIRECT（可切）
         ├─ 国内域名/IP    → DIRECT
         └─ 未匹配         → 🐟 漏网之鱼（MATCH）
```

## DNS 技术细节

### 全链路加密

| 角色 | 服务器 | 协议 | 说明 |
|------|--------|------|------|
| Bootstrap | `tls://223.5.5.5` `tls://223.6.6.6` | DoT | 解析 DoH 域名自身的 IP，阿里 DNS 国内低延迟 |
| 代理节点解析 | `https://doh.pub/dns-query` `tls://223.5.5.5` | DoH / DoT | 解析机场节点域名，**国内 DNS 低延迟，避免自举死锁** |
| 直连流量 | `https://dns.alidns.com/dns-query` | DoH | 国内域名解析，走阿里 DoH |
| 国内分流 | 阿里 DoH + 腾讯 DoH | DoH | `geosite:cn,geolocation-cn,bilibili,biliintl` |
| 国外兜底 | Cloudflare + Google | DoH | 未命中 policy 的域名 |

**无 UDP 53 明文**，全部 DNS 查询经 TLS 加密传输。

### Fake-IP 模式

```
enhanced-mode: fake-ip
fake-ip-range: 198.18.0.1/16
```

- 代理域名返回 `198.18.x.x` 虚拟 IP，请求进入规则引擎后通过域名匹配规则
- 排除名单覆盖：局域网、NTP、STUN/WebRTC、远程工具、QQ 登录、移动认证、B站 CDN、国服战网、节点域名
- 直连域名通过 `direct-nameserver` 解析真实 IP

### DNS 查询链路

```
国内域名：fake-ip → nameserver-policy 匹配 geosite:cn → 阿里/腾讯 DoH
国外域名：fake-ip → 未命中 policy → Cloudflare/Google DoH
节点域名：proxy-server-nameserver → DNSPod DoH/DoT（独立通道，避免循环依赖）
aistudio.google.com → 单独走国外 DoH（防止国内 DNS 污染）
```

## 策略组

### 基础设施组（3 个）

| 组 | 类型 | 测速 URL | 行为 |
|----|------|----------|------|
| `🎯 节点选择` | select | — | 手动选择入口 |
| `⚡ 自动选择` | url-test | `gstatic.com/generate_204` | 300s 测速，延迟最低胜出，tolerance=150ms |
| `🔄 故障转移` | fallback | `gstatic.com/generate_204` | 按序尝试，首个可用即为选中，300s 重检 |

### 业务策略组（9 个）

| 组 | 默认策略 | 可用选项 |
|----|----------|----------|
| `🤖 AI 服务` | 🎯 节点选择 | 全部节点 + DIRECT |
| `📹 YouTube` | 🎯 节点选择 | 全部节点 + DIRECT |
| `✈️ Telegram` | 🎯 节点选择 | 全部节点 + DIRECT |
| `🎬 流媒体` | 🎯 节点选择 | 全部节点 + DIRECT |
| `🍎 苹果服务` | DIRECT | DIRECT + 全部节点 |
| `Ⓜ️ 微软服务` | DIRECT | DIRECT + 全部节点 |
| `🏠 国内直连` | DIRECT | DIRECT |
| `🛑 广告拦截` | REJECT | REJECT / DIRECT |
| `🐟 漏网之鱼` | 🎯 节点选择 | 全部节点 + DIRECT + REJECT |

每个业务组 **独立列出所有订阅节点**，无需通过 `🎯 节点选择` 跳转即可直选任意节点。

### 选型说明

- **url-test vs fallback**：url-test 适合日常使用（自动选最快），fallback 适合需要稳定单一出口的场景
- **为什么流媒体不走 url-test**：部分流媒体平台检测 IP 频繁切换，手动锁定节点更稳定
- **为什么漏网之鱼包含 REJECT**：排查规则遗漏时可以临时 REJECT 未匹配流量，观察日志定位新域名

## 规则覆盖

### 远程规则集（9 个 MRS <sup>①</sup>）

| 规则集 | 来源 | 更新间隔 |
|--------|------|----------|
| `anti-ad` | DustinWin/ruleset_geodata | ~23.7h |
| `openai` | MetaCubeX/meta-rules-dat | ~23.8h |
| `tiktok` | MetaCubeX/meta-rules-dat | ~23.8h |
| `github` | MetaCubeX/meta-rules-dat | ~23.8h |
| `microsoft` | MetaCubeX/meta-rules-dat | ~23.8h |
| `apple` | MetaCubeX/meta-rules-dat | ~23.8h |
| `proxy_sites` | MetaCubeX/meta-rules-dat (`geolocation-!cn`) | ~24h |
| `cn_sites` | MetaCubeX/meta-rules-dat (`cn`) | ~24h |
| `gfw` | MetaCubeX/meta-rules-dat (`gfw`) | ~24h |

<sup>①</sup> MRS 是 Mihomo Rule Set 的缩写，为 Mihomo 内核专有的二进制规则集格式，相比文本规则集解析更快、占用更低。

所有规则集通过 `fastly.jsdelivr.net` CDN 分发，间隔错开避免同时更新。

### 内置域名规则（~180 条，大量引用 GEOSITE 分类保持自动更新）

| 类别 | 数量 | 典型域名/规则 |
|------|------|----------|
| 广告拦截 | 2 | `category-ads-all` + `anti-ad` 规则集 |
| anti-ad 白名单 | 4 | 火山引擎 APM / 极光推送（anti-ad 误伤游戏基础设施） |
| QUIC 阻断 | 5 | 微软/苹果/YouTube/Google 豁免 QUIC，其余非中国站点 REJECT |
| 局域网 | 5 | `private` / `localhost` / `local` |
| 进程直连 | 17 | 微信、QQ、远程桌面、Tailscale、frpc 等 |
| 前置拦截 | 3 | `jsdelivr.net` / `dns.google` 确保走代理 |
| YouTube | 1 | `GEOSITE,youtube`（含 youtube.com / googlevideo.com / ytimg.com 等） |
| AI 服务 | 27 | OpenAI / Claude / Gemini / Perplexity / Cursor / HuggingFace 等 |
| Google 基础 | 2 | `gstatic.com` / `googleapis.com` |
| DeepSeek | 1 | 国内直连 |
| Telegram | 1 | `GEOSITE,telegram`（含 telegram.org / t.me / telegram.me 等） |
| 海外社交 | 15 | 14 项 `GEOSITE` 引用（Twitter/Facebook/Instagram/Pixiv 等）+ snapchat |
| 流媒体 | 14 | 9 项 `GEOSITE` 引用（Netflix/Spotify/Disney 等）+ 4 项硬编码 + tiktok 规则集 |
| 游戏平台（国服） | 1 | `GEOSITE,category-games-cn`（米哈游/腾讯/库洛等 DIRECT） |
| 游戏平台（海外） | 1 | `GEOSITE,category-games-!cn`（Steam/Epic/Blizzard 等走代理） |
| 开发工具 | 42 | GitHub / Docker / JetBrains / npm / PyPI / Vercel 等 |
| 苹果 | 5 | Apple 规则集 + `icloud.com` 直连 |
| 微软 | 8 | Microsoft 规则集 + 商店/更新 CDN 直连 |
| 国内直连 | 15 | 百度 / 阿里 / 腾讯 / 字节等 |
| 端口直连 | 6 | NTP `123` / STUN `3478-3479` 等 |
| Google .cn | 2 | `services.googleapis.cn` / `googleapis.cn` |
| 基础分流 | 5 | GFW / cn_sites / GEOSITE:cn / proxy_sites / GEOIP CN |
| MATCH | 1 | 漏网之鱼兜底 |

### 规则优先级

规则按从上到下的顺序匹配，首次命中即停止。顺序遵循：

```
REJECT（广告/QUIC） → DIRECT（局域网/进程） → 业务分组 → 规则集分流 → GEOIP CN → MATCH
```

`googleapis.com` 通配规则排在 AI 专属子域名（如 `generativelanguage.googleapis.com`）**之后**，避免遮蔽。

## 节点分类逻辑

覆写脚本接管订阅的所有代理节点，通过以下逻辑动态构建策略组：

```
config.proxies（订阅原始节点列表）
  │
  ├─ 过滤：排除名称中包含「剩余/到期/套餐/流量/官网/免费/试用」等信息节点
  │
  └─ 有效节点 → c.ALL
       │
       ├─ ⚡ 自动选择 (url-test) ← 全量节点
       ├─ 🔄 故障转移 (fallback) ← 全量节点
       ├─ 🎯 节点选择 (select)   ← ⚡ + 🔄 + 全量节点 + DIRECT
       └─ 所有业务组 (select)     ← 🎯 + ⚡ + 🔄 + 全量节点 + DIRECT
```

不使用 `filter` 字段，而是直接构建 `proxies` 数组传入各组，兼容性最好。

## 覆盖范围

脚本会**完全替换**订阅自带的以下内容：

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

修改 `⚡ 自动选择` 组：

```js
upsertGroup(config, {
  name: '⚡ 自动选择', type: 'url-test',
  url: 'http://www.gstatic.com/generate_204',
  interval: 300,    // 测速间隔（秒）
  tolerance: 150,   // 切换阈值（毫秒）
  lazy: true,       // 按需触发
  proxies: allNodes.slice()
})
```

### 添加自定义 skip-domain

在 `overwriteGeneral` 函数的 sniffer 配置中追加：

```js
'skip-domain': [
  '你的节点域名1',
  '你的节点域名2',
  // ... 保留原有条目
]
```

## 常见问题

### 谷歌商店下载等待中

已内置修复：`services.googleapis.cn` / `googleapis.cn` 走 `🎯 节点选择`。

### 某个服务走了错误的线路

1. FLClash → 配置 → 点击订阅 → 日志
2. 搜索目标域名
3. 确认匹配的规则及顺序
4. 如确需调整，修改覆写脚本中 `injectRules` 函数的规则顺序

### 覆写不生效

1. 确认覆写已关联到对应订阅
2. 下拉刷新订阅
3. 确认日志中有 `[v2.4]` 前缀的输出
4. 如果日志为空，检查 FLClash 版本是否 ≥ v0.8.85

### 部分节点未出现在策略组

检查节点名称是否命中了 `isInfoNode` 的过滤正则。在 FLClash 日志中搜索 `[v2.3] Valid proxies` 查看过滤后数量。

### 如何更新覆写脚本

FLClash → 右下角 **工具** → **进阶设置** → **脚本** → 点击脚本 → 右上角 **⋮** → **外部获取** → 重新通过 URL 导入 → 下拉刷新订阅。
