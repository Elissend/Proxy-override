# -*- coding: utf-8 -*-
"""YAML 校验 + 与 JS 生成结果的一致性对比(本地与 CI 通用)

用法:
    node scripts/validate.js --dump > /tmp/js-dump.json
    python scripts/validate.py /tmp/js-dump.json
"""
import io, json, os, sys

import yaml

ROOT = os.path.join(os.path.dirname(__file__), '..')
dump_path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/js-dump.json'

js = json.load(io.open(dump_path, encoding='utf-8'))
y = yaml.safe_load(io.open(os.path.join(ROOT, 'proxy-override.yaml'), encoding='utf-8'))

errs = []

# JS ↔ YAML 三大块逐字节一致
if y['rules'] != js['rules']:
    diff = [(a, b) for a, b in zip(y['rules'], js['rules']) if a != b]
    errs.append('rules 不一致,差异 %d 处,首处: %s' % (len(diff), diff[:1]))
if y['rule-providers'] != js['providers']:
    ka, kb = set(y['rule-providers']), set(js['providers'])
    errs.append('rule-providers 不一致: 仅YAML=%s 仅JS=%s' % (ka - kb, kb - ka))
if y['dns'] != js['dns']:
    errs.append('dns 配置不一致')

# YAML 独有项
if 'global-client-fingerprint' in y:
    errs.append('global-client-fingerprint 已被内核移除,不应存在')
if y.get('secret') in (None, ''):
    errs.append('secret 缺失(应为占位符提示)')
hc = y['proxy-providers']['sub']['health-check']
if not hc.get('lazy'):
    errs.append('订阅 health-check 应为 lazy')

if errs:
    print('YAML 校验失败:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print('YAML 校验通过:与 JS 生成结果完全一致(%d 条规则 / %d 个规则集)'
      % (len(y['rules']), len(y['rule-providers'])))
