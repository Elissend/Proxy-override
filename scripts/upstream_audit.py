# -*- coding: utf-8 -*-
"""上游漂移哨兵(每周 CI 运行,也可本地手动跑)

用法:
    git clone --depth 1 https://github.com/v2fly/domain-list-community /tmp/dlc
    python scripts/upstream_audit.py /tmp/dlc/data

检查两类漂移:
  A. 关键域名归属——历史上翻过车/打过架的判定是否仍然成立
  B. 正则条目漂移——v4.1 用 DOMAIN-REGEX 补偿的正则,其上游源是否
     新增(需要跟进补偿)或删除(补偿可退役)
"""
import io, os, re, sys, time
import urllib.request

DATA = sys.argv[1] if len(sys.argv) > 1 else '/tmp/dlc/data'
LIST_BASE = 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo'
failures = []


def fetch(url, retries=3):
    for i in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:
            if i == retries - 1:
                failures.append('拉取失败: %s (%s)' % (url, e))
                return ''
            time.sleep(3)


def check(cond, msg):
    if not cond:
        failures.append(msg)


# ---- A. 关键域名归属 ----
ai = fetch(LIST_BASE + '/geosite/category-ai-!cn.list')
if ai:
    check('chatgpt.com' in ai, 'AI 集缺失 chatgpt.com——AI 分流可能失效')
    check('anthropic.com' in ai, 'AI 集缺失 anthropic.com')
    check('deepseek' not in ai, 'deepseek 被收进 AI-!cn 集——国内 AI 会误走代理,需加直连钉子')

cn = fetch(LIST_BASE + '/geosite/cn.list')
if cn:
    lines = set(cn.split('\n'))
    check('+.cn' in lines, 'cn 集丢失 +.cn 顶级域兜底——国内 .cn 域名分流将大面积漂移')
    check('+.deepseek.com' in lines, 'cn 集丢失 deepseek.com')

geoip_cn = fetch(LIST_BASE + '/geoip/cn.list')
if geoip_cn:
    check(len(geoip_cn.splitlines()) > 1000, 'geoip cn 段数异常(<1000),疑似构建事故')

geoip_tg = fetch(LIST_BASE + '/geoip/telegram.list')
if geoip_tg:
    check(len(geoip_tg.splitlines()) >= 5, 'geoip telegram 段数异常(<5)')

# ---- B. 正则条目漂移 ----
# v4.1 补偿所依据的上游正则全集(geolocation-!cn 刻意除外:其目标与兜底一致)
KNOWN = {
    r'.+\.awsdns-cn-[0-9][0-9]\.(biz|com|net|top)$',
    r'.+\.awsdns-cn-[0-9][a-e0-9]\.cn$',
    r'.+\.awsdns-[0-9][0-9]\.(co\.uk|com|net|org)$',
    r'^hses[1-7]?\.akamaized\.net$',
    r'^r+[0-9]+(---|\.)sn-(2x3|ni5|j5o)\w{5}\.xn--ngstr-lra8j\.com$',
    r'^r+[0-9]+(---|\.)sn-(2x3|ni5|j5o)\w{5}\.googlevideo\.com$',
    r'^.+-mihayo\.akamaized\.net$',
    r'^speed\.(coe|open)\.ad\.[a-z]{2,6}\.prod\.hosts\.ooklaserver\.net$',
    r'^chatgpt-async-webps-prod-\S+-\d+\.webpubsub\.azure\.com$',
    r'^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$',
    r'(^|\.)apiproxy-device-prod-nlb-.+\.amazonaws\.com$',
    r'(^|\.)apiproxy-website-nlb-prod-.+\.amazonaws\.com$',
    r'(^|\.)dualstack\.apiproxy-.+\.amazonaws\.com$',
    r'(^|\.)dualstack\.ichnaea-web-.+\.amazonaws\.com$',
    r'^[0-9]+vod-adaptive\.akamaized\.net$',
    r'^cdn\d-epicgames-\d+\.file\.myqcloud\.com$',
    r'^epicgames-download\d-\d+\.file\.myqcloud\.com$',
    r'^epicgames-download\d\.akamaized\.net$',
    r'.+\.dkr\.ecr\.[^\.]+\.amazonaws\.com$',
}
CATS = ['private', 'category-ads-all', 'google', 'netflix', 'disney', 'vimeo',
        'category-games', 'category-dev', 'cn', 'geolocation-cn', 'category-ai-!cn']


def resolve_regexps(name, seen=None):
    if seen is None:
        seen = set()
    if name in seen:
        return set()
    seen.add(name)
    path = os.path.join(DATA, name)
    if not os.path.exists(path):
        return set()
    out = set()
    for raw in io.open(path, encoding='utf-8'):
        entry = raw.split('#')[0].strip().split()
        if not entry:
            continue
        e = entry[0]
        if e.startswith('include:'):
            out |= resolve_regexps(e[8:], seen)
        elif e.startswith('regexp:'):
            out.add(e[7:])
    return out


if os.path.isdir(DATA):
    found = set()
    for c in CATS:
        found |= resolve_regexps(c)
    new = found - KNOWN
    gone = KNOWN - found
    check(not new, '上游新增正则条目(mrs 不含,需评估是否补偿): %s' % sorted(new))
    check(not gone, '上游删除了我们补偿所依据的正则(补偿可退役): %s' % sorted(gone))
else:
    failures.append('v2fly 数据目录不存在: %s' % DATA)

if failures:
    print('上游漂移警报:')
    for f in failures:
        print(' -', f)
    sys.exit(1)
print('上游状态健康:关键归属与正则条目均无漂移')
