# FLClash 通用代理覆写脚本

适用于 FLClash v0.8.85+，标准 Mihomo 内核，任何机场订阅均可使用。

## 功能

- **全加密 DNS**：DoH / DoT，无明文泄漏，国内 DNS 走阿里/腾讯，国外走 Cloudflare/Google
- **12 策略组**：3 基础设施组 + 9 业务分流组，每个组均可独立切换到任意节点
- **智能分流**：AI 服务 / YouTube / Telegram / 流媒体 / 苹果 / 微软 / 国内直连 / 广告拦截 / 漏网之鱼
- **9 远程规则集**：MRS 格式，自动更新
- **完整查询覆盖**：海外社交、游戏平台、开发工具、流媒体均精准分流
- **Google 服务优化**：谷歌商店下载修复、AI API 准确分流
- **无需硬编码节点**：动态扫描订阅节点，自动排除流量/到期等无效信息

## 快速开始

### 第 1 步：导入覆写脚本

FLClash → **配置** → **覆写脚本** → 右上角 **+** → 输入名称 → 粘贴以下 URL：

```
https://raw.githubusercontent.com/{你的用户名}/{仓库名}/main/proxy-override.js
```

保存。

### 第 2 步：关联到订阅

配置页 → 订阅卡片 **⋮** → **更多** → **覆写** → 点选刚才创建的脚本 → 确定 → 下拉刷新订阅。

### 第 3 步：配置外部资源（必做）

编辑该订阅 → **外部资源** 标签 → 粘贴以下内容：

```yaml
geosite: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat"
geoip: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat"
```

> 此步骤由 FLClash App UI 托管，覆写脚本无法自动注入，必须手动配置。GeoData 文件是 GEOSITE / GEOIP 规则正常运行的前提。

## 策略组架构

```
┌─ ⚡ 自动选择 (url-test) ─── 从所有节点中自动选延迟最低的
├─ 🔄 故障转移 (fallback) ─── 按顺序尝试节点，首个可用即为选中
├─ 🎯 节点选择 (select) ──── 手动选择入口，汇聚所有节点
│
├─ 🤖 AI 服务 ────────────── OpenAI / Claude / Gemini / Perplexity 等
├─ 📹 YouTube ─────────────── YouTube 全家桶
├─ ✈️ Telegram ────────────── Telegram 全家桶
├─ 🎬 流媒体 ──────────────── Netflix / Disney+ / Spotify / TikTok 等
├─ 🍎 苹果服务 ────────────── 默认直连，可切代理
├─ Ⓜ️ 微软服务 ────────────── 默认直连，可切代理
├─ 🏠 国内直连 ────────────── 始终直连
├─ 🛑 广告拦截 ────────────── 默认 REJECT
└─ 🐟 漏网之鱼 ────────────── MATCH 最终兜底，未命中规则的流量
```

每个业务组均可独立选择任意节点，也可跟随 `🎯 节点选择`。

## DNS 配置

| 角色 | 服务器 | 协议 |
|------|--------|------|
| Bootstrap | `tls://223.5.5.5` / `tls://223.6.6.6` | DNS over TLS |
| 代理节点解析 | `https://dns.alidns.com/dns-query` / `tls://223.5.5.5` | DoH / DoT |
| 直连流量解析 | `https://dns.alidns.com/dns-query` | DoH |
| 国内域名分流 | 阿里 DoH / 腾讯 DoH | DoH |
| 国外域名分流 | Cloudflare / Google | DoH |

全链路加密，无 UDP 53 明文泄漏。

Fake-IP 模式，排除名单覆盖局域网、远程工具、NTP、STUN、认证检测、QQ 登录、B站 CDN、国服战网等。

## 规则覆盖

| 类别 | 覆盖范围 |
|------|----------|
| AI 服务 | OpenAI / ChatGPT / Claude / Gemini / Perplexity / Mistral / Cohere / Midjourney / Stability / Cursor / HuggingFace / Replicate / Suno / OpenRouter / RunPod / xAI / Grok / Copilot |
| YouTube | youtube.com / youtu.be / googlevideo.com / ytimg.com / ggpht.com |
| Telegram | telegram.org / telegram.me / t.me |
| 流媒体 | Netflix / Disney+ / Spotify / Hulu / HBO Max / Prime Video / Twitch / TikTok / Discovery+ / Paramount+ / Peacock / Vimeo / Dailymotion / Crunchyroll |
| 海外社交 | Twitter/X / Reddit / Facebook / Instagram / LinkedIn / Snapchat / Pinterest / Threads / Bluesky / Quora / Medium / Imgur / Flickr / Tumblr / Pixiv |
| 游戏平台 | Steam / Epic / EA / Ubisoft / Riot / Blizzard / Nintendo / PlayStation / Xbox / Hoyoverse / GOG / Rockstar |
| 开发工具 | GitHub / GitLab / Docker / JetBrains / npm / PyPI / Cargo / RubyGems / NuGet / Packagist / Stack Overflow / Vercel / Netlify / Cloudflare Workers / Sentry / Postman / Notion / Figma / Atlassian / HashiCorp |
| 远程规则集 | anti-ad / openai / tiktok / github / microsoft / apple / proxy_sites (!cn) / cn_sites / gfw + GEOSITE 内置规则 |

## 常见问题

### 谷歌商店下载一直等待

已内置修复：`services.googleapis.cn` / `googleapis.cn` / `xn--ngstr-lra8j.com` 走 🎯 节点选择。

### 某个服务走了错误的组

FLClash → 配置 → 点击日志 → 搜索域名 → 找到匹配的规则 → 确认规则顺序是否合理。如需调整，联系维护者更新覆写脚本。

### 覆写不生效

1. 确认已关联覆写到对应订阅
2. 下拉刷新订阅
3. 检查「外部资源」标签是否正确配置了 GeoX URL
4. 检查覆写脚本是否与该订阅的覆写列表关联

### 如何自定义

直接编辑覆写脚本内容，FLClash 会在刷新订阅时重新应用。常见自定义：
- 修改 `skip-domain` 添加自己的节点域名
- 调整策略组的 `proxies` 顺序
- 增删 `fake-ip-filter` 条目
