/**
 * 校验 mp-weixin 产物完整性：
 *  1) app.json 里所有 pages / subPackages 页面的 .js/.wxml/.json 是否齐全；
 *  2) 每个页面/组件 json 的 usingComponents 指向的组件是否真实存在；
 * 用来定位「Failed to load resource 500」到底缺哪个文件。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.argv[2] || 'dist/build/mp-weixin'
const problems = []

function exists(p) {
  return fs.existsSync(path.join(ROOT, p))
}

function checkPage(route) {
  for (const ext of ['.js', '.wxml', '.json']) {
    if (!exists(`${route}${ext}`)) problems.push(`[page] 缺少 ${route}${ext}`)
  }
  const jsonPath = path.join(ROOT, `${route}.json`)
  if (!fs.existsSync(jsonPath)) return
  const cfg = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const comps = cfg.usingComponents || {}
  for (const [name, rel] of Object.entries(comps)) {
    // 组件路径可能是绝对（/components/x/y）或相对
    const base = rel.startsWith('/') ? rel.slice(1) : path.posix.join(path.posix.dirname(route), rel)
    for (const ext of ['.js', '.wxml', '.json']) {
      if (!exists(`${base}${ext}`)) problems.push(`[component] ${route} -> <${name}> 缺少 ${base}${ext}`)
    }
  }
}

const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))

for (const p of app.pages || []) checkPage(p)
for (const sub of app.subPackages || []) {
  for (const p of sub.pages || []) checkPage(`${sub.root}/${typeof p === 'string' ? p : p.path}`)
}

if (problems.length === 0) {
  console.log('OK：app.json 与 usingComponents 引用的文件全部存在')
} else {
  console.log(`发现 ${problems.length} 个问题：`)
  for (const p of problems) console.log(' -', p)
}
