# ProxyOverride

[![GitHub Repo stars](https://img.shields.io/github/stars/Elissend/Proxy-override?style=flat)](https://github.com/Elissend/Proxy-override/stargazers)
![GitHub commit activity](https://img.shields.io/github/commit-activity/t/Elissend/Proxy-override?style=flat)
[![jsDelivr hits](https://data.jsdelivr.com/v1/package/gh/Elissend/Proxy-override/badge?style=rounded)](https://www.jsdelivr.com/package/gh/Elissend/Proxy-override)

Mihomo 分流配置,提供 JavaScript 覆写脚本与独立 YAML 模板两种形态。导入后自动生成策略组、分流规则、远程规则集与加密 DNS,开箱即用。

**当前版本 v4.1** · 16 个策略组 · 47 个远程规则集 · 170 条规则(每条冗余删减均经上游列表逐条验证)

> [!IMPORTANT]
> 仓库内自带的「个人自定义区」默认值为作者自用(直连域名、直连端口),使用前请按需替换或清空,见[个人自定义](#个人自定义)。

## 特性

- **完整业务分流**:AI / YouTube / Telegram / 海外社交 / 流媒体 / Google / 开发工具 / 海外游戏 / 苹果 / 微软,国内流量直连兜底
- **BT/P2P 保护**:按进程名(qBittorrent、迅雷等)与公共 tracker 域名强制直连,规避机场封号风险
- **mrs 正则补偿**:mrs 格式不支持正则条目,dat 时代的关键正则(无点主机名直连、ChatGPT 异步通道、Netflix/Epic CDN 分组等)已用 DOMAIN-REGEX 逐条还原
- **HTTPDNS 拦截**:阻止国内 App 绕过域名分流,DNS 行为可控
- **QUIC 精细阻断**:非国内站点的 UDP 443 默认拒绝(强制回落 TCP 走代理,速度更稳),微软/苹果/YouTube/Google 豁免
- **防误伤前置放行**:微信小程序、国内推送/APM/归因 SDK、公共 CDN 不受广告规则波及
- **全加密 DNS**:国内外分流解析,`respect-rules` 防泄露,fake-ip 豁免清单完善
- **内存友好**:全 mrs 规则集,无 geosite.dat/geoip.dat 依赖,内核内存占用更低,安卓后台更稳
- **安全加固**:uTLS 指纹伪装(JS 版自动为节点注入 client-fingerprint)、API 密钥鉴权

## 文件说明

| 文件 | 用途 | 适合谁 |
|------|------|--------|
| `proxy-override.js` | 覆写脚本,叠加在机场订阅上 | 日常使用,推荐 |
| `proxy-override.yaml` | 独立完整配置模板 | 自行管理订阅与配置文件、跑裸内核的用户 |

两个文件的策略组、规则、DNS 完全同步,任选其一。

## 快速开始

### 方式一:JS 覆写(推荐)

脚本地址(二选一):

```text
https://raw.githubusercontent.com/Elissend/Proxy-override/main/proxy-override.js
```

```text
https://fastly.jsdelivr.net/gh/Elissend/Proxy-override@main/proxy-override.js
```

> [!TIP]
> 无法访问 `raw.githubusercontent.com` 时使用第二个 jsDelivr 地址,但内容更新最多有 12 小时缓存延迟。

各客户端导入入口:

- **FlClash**:「工具 → 进阶设置 → 脚本」通过 URL 导入 → 订阅「更多 → 覆写」勾选该脚本 → 刷新订阅
- **Clash Party / Sparkle**:左侧「覆写」粘贴链接导入 → 订阅「编辑信息」选择该覆写 → 保存刷新
- 其他支持 JavaScript 覆写的 Mihomo 客户端同理,入口以客户端说明为准

导入后刷新订阅,确认策略组已替换、「自动选择」中出现订阅节点。

> [!NOTE]
> 脚本不定期更新。升级方法:在客户端重新拉取/刷新脚本,再刷新订阅。

### 方式二:YAML 模板

1. 下载 `proxy-override.yaml`,把 `proxy-providers.sub.url` 替换为你的机场订阅链接
2. 把 `secret` 改成随机字符串(见[API 密钥](#api-密钥仅-yaml-独立部署))
3. 作为 Mihomo 配置文件加载

## 策略组

| 类型 | 策略组 | 默认出口 |
|------|--------|----------|
| 基础 | 节点选择 / 自动选择 / 故障转移 | — |
| 走代理 | AI · YouTube · Telegram · 海外社交 · 流媒体 · Google · 开发工具 · 海外游戏 | 节点选择 |
| 默认直连 | 苹果 · 微软 · 国内直连 | DIRECT |
| 拦截 | 广告拦截 | REJECT |
| 兜底 | 漏网之鱼 | 节点选择 |

名称含「剩余、到期、套餐、流量、官网、免费、试用、登录」等关键词的订阅条目会被识别为信息节点,不加入策略组;需调整时修改脚本中 `isInfoNode` 的正则。

## 规则设计

规则按以下顺序匹配(先命中先生效):

```
BT/P2P 直连 → 个人自定义直连 → 误伤放行 → HTTPDNS 拦截
→ 局域网直连 → 国内 IP 直连 → 广告拦截 → QUIC 阻断
→ 业务分流(AI/流媒体/…) → 国内外兜底 → 漏网之鱼
```

几个值得了解的设计决策:

- **局域网和国内 IP 排在 QUIC 阻断之前**——否则无域名的纯 IP UDP 443 流量(NAS、国内直连服务)会被误杀
- **Telegram 有专门的 GEOIP 规则**——TG 客户端大量使用纯 IP 直连且无 SNI,仅靠域名规则会全部漏掉
- **AI 使用 `category-ai-!cn` 规则集**——覆盖 OpenAI/Claude/Gemini/Copilot/Perplexity 等,且保证 Gemini/AIStudio 归入 AI 组(对节点地区敏感);国内 AI(DeepSeek、Kimi、豆包等)无需任何单独规则,cn 规则集兜底直连
- **`volces.com` 整域直连**——火山引擎是字节国内云(豆包/方舟 API),字节海外业务走 BytePlus 系域名,互不影响
- **HTTPDNS 拦截位于误伤放行之后**——个别 App 因此异常时,在个人自定义区加一条直连即可豁免

## TUN、DNS 与严格路由

TUN 开关由客户端控制,脚本不干预。使用 TUN 时建议开启:TUN、自动路由、DNS 劫持;不需要访问局域网设备时再开 `strict-route`。

`strict-route` 用于限制流量绕过 TUN(如 Windows 多网卡同时向路由器 DNS 发查询造成的泄露),代价是路由器管理页、NAS、打印机、局域网游戏等可能无法访问——遇到问题先临时关闭,确认后再单独放行所需网段。

DNS 采用 fake-ip + 全加密:国内域名走阿里 DNS/DNSPod,其余走 Cloudflare/Google DoH,查询路径遵循分流规则(`respect-rules`)。注意 Android「私人 DNS」、浏览器安全 DNS、局域网 DNS 都可能绕过客户端——DNS 测试异常时先关闭或统一这些设置。

泄露判断:测试结果显示路由器/运营商 DNS,基本可确认存在绕过;仅显示 Cloudflare/Google 等配置内上游,则需结合出口 IP 判断,不一定是泄露。

## 个人自定义

仓库内的默认自定义项是作者自用的,使用前请替换或清空:

| 文件 | 位置 | 内容 |
|------|------|------|
| `proxy-override.js` | 顶部「个人自定义区」 | `CUSTOM_DIRECT_DOMAINS`(直连域名)、`CUSTOM_DIRECT_PORTS`(直连端口) |
| `proxy-override.yaml` | `rules` 中 BT/P2P 直连段之后的「个人自定义直连」段 | 同上,逐条规则形式 |

自定义直连排在广告拦截和业务分流之前,适合放行公司内网、学校系统、小程序、游戏端口等。

## API 密钥(仅 YAML 独立部署)

`external-controller` 是 Mihomo 的本机管理 API(面板、切换节点、查看连接都靠它)。虽然只监听 127.0.0.1,但浏览器网页可以向本机端口发请求,无密钥时存在被恶意网页操控的风险。

使用 YAML 模板前,把 `secret` 改成你自己的随机字符串:

```powershell
# Windows PowerShell
-join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

```bash
# Linux / macOS
openssl rand -hex 16
```

Web 面板(如 [metacubexd](https://metacubex.github.io/metacubexd/))连接 `127.0.0.1:9090` 时填写该密钥。JS 覆写用户无需关心——API 由客户端自行管理,脚本不设置此项。

## 排错

1. 刷新订阅后,确认策略组和规则已替换,「自动选择」中出现订阅节点
2. 某个服务异常时,在客户端「连接」页复现一次,记录目标域名、命中规则和策略组
3. 按命中情况处理:

   | 命中规则 | 症状 | 处理 |
   |----------|------|------|
   | `anti-ad` / `ads-all` | 国内 App 功能异常、图片加载失败 | 在自定义区加对应域名直连 |
   | `RULE-SET,httpdns` | 个别 App 首次联网慢或报错 | 同上,前置放行对应域名 |
   | QUIC `REJECT` | 某站点 UDP 443 被拒 | 正常设计(强制回落 TCP);确有需要可仿照微软/苹果加豁免 |
   | `漏网之鱼` | 走了代理但希望直连 | 为实际域名添加直连规则并前置 |

4. DNS 查询失败时,先确认节点可用,再检查客户端没有覆盖脚本的 DNS 设置

脚本运行时会输出以 `[v4.1]` 开头的日志,但部分客户端不显示 `console.log`,不能作为唯一判断依据。

## 反馈

分流有误伤或遗漏时欢迎提 [Issue](https://github.com/Elissend/Proxy-override/issues):附上目标域名、「连接」页命中的规则和策略组,能大幅加快定位。

## 致谢

- [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat) — geosite/geoip 数据与 mrs 规则集
- [DustinWin/ruleset_geodata](https://github.com/DustinWin/ruleset_geodata) — 广告拦截规则集
- [Koolson/Qure](https://github.com/Koolson/Qure) — 策略组图标

## 特别声明

> [!WARNING]
> 本项目仅用于 Mihomo 相关技术的学习与研究,不涉及任何具体使用场景或用途导向。请在遵守当地法律法规的前提下使用;因使用本项目产生的一切后果由使用者自行承担。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Elissend/Proxy-override&type=Date)](https://star-history.com/#Elissend/Proxy-override&Date)
