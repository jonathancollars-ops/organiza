import re

files = [
    'package.json', 'app.json', 'src/utils/version.ts',
    'test/app_update_and_semver.test.ts',
    'test/challenger_m1_deep_adversarial.test.ts',
    'test/ci_and_build_config.test.ts',
    '.github/workflows/build-android.yml'
]

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        text = file.read()
    
    # We are bumping from 3.2.0 to 3.2.1
    # First, let's fix the tests that expect 3.2.1 as "newer than 3.2.0" to expect "3.2.2 as newer than 3.2.1"
    if 'challenger' in f:
        text = text.replace("'3.2.1'", "'3.2.2'")
        text = text.replace("3.2.1 is newer", "3.2.2 is newer")
        text = text.replace("'v3.2.1'", "'v3.2.2'")
        text = text.replace("v3.2.1 prefix", "v3.2.2 prefix")
        text = text.replace("'3.2.1-beta.1'", "'3.2.2-beta.1'")
        text = text.replace("3.2.1-beta.1", "3.2.2-beta.1")
        
    if 'app_update_and_semver' in f:
        text = text.replace("p1.minor, 2", "p1.minor, 2")
        text = text.replace("p1.patch, 0", "p1.patch, 1")
        text = text.replace("'3.2.0'", "'3.2.1'")
        text = text.replace("3.2.0 > 3.1.99", "3.2.1 > 3.1.99")
        text = text.replace("is 3.2.0", "is 3.2.1")
        text = text.replace("raw, '3.2.1'", "raw, '3.2.1'")

    text = text.replace('3.2.0', '3.2.1')
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(text)
