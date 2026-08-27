import re

files = ['test/ci_and_build_config.test.ts', 'test/nomenclature_and_branding.test.ts']
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        text = file.read()
    text = re.sub(r'3\.1\.\d+', '3.2.0', text)
    with open(f, 'w', encoding='utf-8') as file:
        file.write(text)
