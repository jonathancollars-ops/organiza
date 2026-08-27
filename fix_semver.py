f = 'test/app_update_and_semver.test.ts'
with open(f, 'r', encoding='utf-8') as file:
    text = file.read()

text = text.replace("getCurrentVersion(), '3.1.2'", "getCurrentVersion(), '3.2.0'")
text = text.replace("getCurrentVersion(), '3.1.3'", "getCurrentVersion(), '3.2.0'")
text = text.replace("Current version is 3.1.2", "Current version is 3.2.0")
text = text.replace("Current version is 3.1.3", "Current version is 3.2.0")

with open(f, 'w', encoding='utf-8') as file:
    file.write(text)
