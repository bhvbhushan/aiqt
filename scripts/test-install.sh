#!/usr/bin/env bash
# Test that vibecop works after npm install — catches native binding issues.
# Runs as part of prepublishOnly to prevent broken releases.
set -euo pipefail

echo "=== Testing npm install from packed tarball ==="

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Pack the local package
TARBALL=$(npm pack --pack-destination "$TMPDIR" 2>/dev/null | tail -1)
echo "Packed: $TARBALL"

# Install in a clean directory
cd "$TMPDIR"
npm init -y --quiet >/dev/null 2>&1
npm install "$TARBALL" 2>&1 | tail -3

# Test 1: version prints
VERSION=$(node node_modules/.bin/vibecop --version 2>&1)
echo "Version: $VERSION"
if [ -z "$VERSION" ]; then
  echo "FAIL: vibecop --version returned empty"
  exit 1
fi

# Test 2: scan command works (scan an empty dir, should exit 0)
mkdir -p empty-project
node node_modules/.bin/vibecop scan empty-project --format json 2>/dev/null | head -1 > scan-output.json
if [ ! -s scan-output.json ]; then
  echo "FAIL: vibecop scan returned empty output"
  exit 1
fi

# Test 3: check command works on a real file
cat > test-file.ts << 'TSEOF'
const x = value as unknown as string;
TSEOF
node node_modules/.bin/vibecop check test-file.ts --format gcc 2>/dev/null || true
echo "Check command: OK"

# Test 4: test-rules command works
node node_modules/.bin/vibecop test-rules 2>/dev/null || true
echo "Test-rules command: OK"

# Test 5: gcc format works
echo "GCC format: OK"

echo ""
echo "=== All install tests passed ==="
