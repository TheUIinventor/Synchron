const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const IGNORES = ['node_modules', '.git', 'public', 'Synchron-mirror']
const exts = ['.ts', '.tsx', '.js', '.jsx']

function walk(dir) {
  const files = []
  for (const name of fs.readdirSync(dir)) {
    if (IGNORES.includes(name)) continue
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) files.push(...walk(full))
    else if (exts.includes(path.extname(name))) files.push(full)
  }
  return files
}

function parseImports(content) {
  const imports = new Set()
  const importRegex = /import\s+(?:.*from\s+)?["']([^"']+)["']/g
  let m
  while ((m = importRegex.exec(content)) !== null) {
    imports.add(m[1])
  }
  return Array.from(imports)
}

const files = walk(ROOT)
const fileMap = {}
for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/')
  try {
    const c = fs.readFileSync(f, 'utf8')
    fileMap[rel] = parseImports(c)
  } catch (e) {
    // ignore
  }
}

// Build edges only for local imports (./ ../ or @/)
const resolveImport = (from, imp) => {
  if (imp.startsWith('@/')) {
    const p = path.join(ROOT, imp.slice(2))
    // try extensions
    for (const e of exts) {
      const attempt = p + e
      if (fs.existsSync(attempt)) return path.relative(ROOT, attempt).replace(/\\/g, '/')
    }
    // try index
    for (const e of exts) {
      const attempt = path.join(p, 'index' + e)
      if (fs.existsSync(attempt)) return path.relative(ROOT, attempt).replace(/\\/g, '/')
    }
    // try directory file without ext
    return null
  }
  if (imp.startsWith('./') || imp.startsWith('../')) {
    const p = path.resolve(path.dirname(path.join(ROOT, from)), imp)
    for (const e of exts) {
      const attempt = p + e
      if (fs.existsSync(attempt)) return path.relative(ROOT, attempt).replace(/\\/g, '/')
    }
    for (const e of exts) {
      const attempt = path.join(p, 'index' + e)
      if (fs.existsSync(attempt)) return path.relative(ROOT, attempt).replace(/\\/g, '/')
    }
    return null
  }
  return null
}

const graph = {}
for (const [file, imps] of Object.entries(fileMap)) {
  graph[file] = []
  for (const imp of imps) {
    const resolved = resolveImport(file, imp)
    if (resolved) graph[file].push(resolved)
  }
}

// detect cycles via DFS
const VISITING = 1, VISITED = 2
const states = {}
const stack = []
const cycles = []

function dfs(node) {
  states[node] = VISITING
  stack.push(node)
  for (const nbr of graph[node] || []) {
    if (!states[nbr]) {
      dfs(nbr)
    } else if (states[nbr] === VISITING) {
      // found a cycle
      const idx = stack.indexOf(nbr)
      const cycle = stack.slice(idx).concat([nbr])
      cycles.push(cycle)
    }
  }
  stack.pop()
  states[node] = VISITED
}

for (const node of Object.keys(graph)) {
  if (!states[node]) dfs(node)
}

if (cycles.length === 0) {
  console.log('No cycles found')
  process.exit(0)
}

console.log('Detected cycles:')
for (const c of cycles) {
  console.log('- ' + c.join(' -> '))
}
process.exit(0)
