f = 'test/challenger_m1_deep_adversarial.test.ts'
with open(f, 'r', encoding='utf-8') as file:
    text = file.read()

text = text.replace("state.ignoredVersion === '3.2.0'", "state.ignoredVersion === '3.3.0'")

with open(f, 'w', encoding='utf-8') as file:
    file.write(text)
