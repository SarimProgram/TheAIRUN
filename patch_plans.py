import os

path = r'c:\Users\MSari6\TheAICoach\app\app\(tabs)\Plans.tsx'
with open(path, 'rb') as f:
    content = f.read()

# We use a smaller target to be safe
target = b'showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 0 }}'
replacement = b'bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: "#FDF2F2" }} contentContainerStyle={{ paddingBottom: 0, backgroundColor: "#FFF" }}'

if target in content:
    new_content = content.replace(target, replacement)
    with open(path, 'wb') as f:
        f.write(new_content)
    print("SUCCESS")
else:
    print("TARGET NOT FOUND")
    # Let's try to find a substring to debug
    if b'showsVerticalScrollIndicator' in content:
        print("PARTIAL MATCH: showsVerticalScrollIndicator found")
    if b'paddingBottom: 0' in content:
        print("PARTIAL MATCH: paddingBottom: 0 found")
