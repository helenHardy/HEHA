#!/usr/bin/env python3
# Script to fix main.js by removing cash register code

import sys

# Read the file
with open('src/main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Lines to remove (0-indexed, so subtract 1)
# Remove lines 247-310 (cash view block) and 196-198 (cash button)
skip_ranges = [
    (246, 310),  # Cash view commented block
    (195, 198)   # Cash button in sidebar
]

# Filter out the lines
new_lines = []
for i, line in enumerate(lines, start=1):
    should_skip = any(start <= i <= end for start, end in skip_ranges)
    if not should_skip:
        new_lines.append(line)

# Write back
with open('src/main.js', 'w', encoding='utf-8', newline='') as f:
    f.writelines(new_lines)

print(f"Fixed! Removed {len(lines) - len(new_lines)} lines")
print(f"Original: {len(lines)} lines, New: {len(new_lines)} lines")
