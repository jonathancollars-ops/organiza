import re

f = 'test/challenger_m1_deep_adversarial.test.ts'
with open(f, 'r', encoding='utf-8') as file:
    text = file.read()

# Lines around 240-260:
text = text.replace("'v3.2.0'", "'v3.3.0'")
text = text.replace("'Lumen v3.2.0 Release'", "'Lumen v3.3.0 Release'")
text = text.replace("tag/v3.2.0", "tag/v3.3.0")
text = text.replace("lumen-v3.2.0.apk", "lumen-v3.3.0.apk")
text = text.replace("newer v3.2.0 release", "newer v3.3.0 release")
text = text.replace("latestVersion === '3.2.0'", "latestVersion === '3.3.0'")
text = text.replace("ignoreVersion('3.2.0')", "ignoreVersion('3.3.0')")

with open(f, 'w', encoding='utf-8') as file:
    file.write(text)
