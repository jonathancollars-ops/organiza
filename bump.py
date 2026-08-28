import re

files = [
    'package.json', 'app.json', 'src/utils/version.ts',
    'test/app_update_and_semver.test.ts',
    'test/challenger_m1_deep_adversarial.test.ts',
    'test/ci_and_build_config.test.ts',
    '.github/workflows/build-android.yml',
    'test/nomenclature_and_branding.test.ts'
]

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        text = file.read()
    
    text = text.replace('3.2.2', '3.3.0')
    text = text.replace('3.2.1', '3.2.2')
    text = text.replace('3.1.9', '3.2.2')
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(text)
