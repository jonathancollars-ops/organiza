import re

files = [
    'test/app_update_and_semver.test.ts',
    'test/challenger_m1_deep_adversarial.test.ts',
    'test/ci_and_build_config.test.ts'
]
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        text = file.read()
    text = re.sub(r'3\.1\.\d+', '3.2.0', text)
    with open(f, 'w', encoding='utf-8') as file:
        file.write(text)
