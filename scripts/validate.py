# -*- coding: utf-8 -*-
"""YAML 校验 + 与 JS 生成结果的一致性对比(本地与 CI 通用)

用法:
    node scripts/validate.js --dump > js-dump.json
    python scripts/validate.py js-dump.json
"""
import io, json, os, sys, tempfile

import yaml

ROOT = os.path.join(os.path.dirname(__file__), '..')
# 默认路径用系统临时目录,兼容 Windows(/tmp 仅存在于类 Unix)
dump_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), 'js-dump.json')

js = json.load(io.open(dump_path, encoding='utf-8'))
y = yaml.safe_load(io.open(os.path.join(ROOT, 'proxy-override.yaml'), encoding='utf-8'))

errs = []

# JS ↔ YAML 三大块逐字节一致
if y['rules'] != js['rules']:
    if len(y['rules']) != len(js['rules']):
        errs.append('rules 数量不一致: YAML=%d JS=%d' % (len(y['rules']), len(js['rules'])))
    else:
        diff = [(i, a, b) for i, (a, b) in enumerate(zip(y['rules'], js['rules'])) if a != b]
        errs.append('rules 内容不一致 %d 处,首处 #%d: YAML=%r JS=%r' % (len(diff), diff[0][0], diff[0][1], diff[0][2]))
if y['rule-providers'] != js['providers']:
    ka, kb = set(y['rule-providers']), set(js['providers'])
    if ka != kb:
        errs.append('rule-providers 键不一致: 仅YAML=%s 仅JS=%s' % (sorted(ka - kb), sorted(kb - ka)))
    else:
        bad = [k for k in ka if y['rule-providers'][k] != js['providers'][k]]
        errs.append('rule-providers 字段不一致的项: %s' % sorted(bad))
if y['dns'] != js['dns']:
    keys = set(y['dns']) | set(js['dns'])
    bad = sorted(k for k in keys if y['dns'].get(k) != js['dns'].get(k))
    errs.append('dns 不一致的键: %s' % bad)

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
