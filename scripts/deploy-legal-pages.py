#!/usr/bin/env python3
"""Publish only the PW OS public documents to an existing Azure Storage account."""
import argparse
import json
import os
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--account', default='pwoslegal2026')
parser.add_argument('--resource-group', default='pw-os-prod')
args = parser.parse_args()
source = Path(__file__).resolve().parents[1] / 'public' / 'legal'
expected = {'index.html', 'privacidade.html', 'termos.html', 'exclusao-de-dados.html', '404.html', 'legal.css'}
if {p.name for p in source.iterdir()} != expected:
    raise SystemExit('Unexpected public file set; refusing upload.')

def az(arguments, env=None):
    return subprocess.check_output(['az', *arguments, '--only-show-errors', '-o', 'json'], env=env, text=True)

# Keep the credential in process memory, never in command arguments or output.
keys = json.loads(az(['storage', 'account', 'keys', 'list', '-g', args.resource_group, '-n', args.account]))
env = dict(os.environ, AZURE_STORAGE_ACCOUNT=args.account, AZURE_STORAGE_KEY=keys[0]['value'])
az(['storage', 'blob', 'service-properties', 'update', '--static-website', '--index-document', 'index.html', '--404-document', '404.html'], env)
for name in sorted(expected):
    mime = 'text/css; charset=utf-8' if name.endswith('.css') else 'text/html; charset=utf-8'
    az(['storage', 'blob', 'upload', '--container-name', '$web', '--name', name, '--file', str(source / name), '--overwrite', 'true', '--content-type', mime, '--content-cache-control', 'public, max-age=300'], env)
endpoint = json.loads(az(['storage', 'account', 'show', '-g', args.resource_group, '-n', args.account]))['primaryEndpoints']['web']
for name in ['privacidade.html', 'termos.html', 'exclusao-de-dados.html']:
    print(endpoint + name)
