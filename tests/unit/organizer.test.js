const fs = require('fs')
const path = require('path')
const os = require('os')
const Organizer = require('../../src/organizer')

function tmpDir(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)) }

describe('Organizer', () => {
  test('categorizes and plans moves on dry-run', () => {
    const src = tmpDir('org-src-')
    const root = tmpDir('org-dest-')
    fs.writeFileSync(path.join(src, 'doc.pdf'), 'x')
    fs.writeFileSync(path.join(src, 'pic.png'), 'x')
    const org = new Organizer({ config: { autoOrganize: { paths: [src], rules: { moveAfterDays: 0 } } }, root })
    const res = org.organizePaths([src], { dryRun: true })
    const moved = res.moved.map(m => ({ from: path.basename(m.from), to: m.to.replace(root + path.sep, '') }))
    expect(moved.find(m => m.from === 'doc.pdf').to).toContain('Documents')
    expect(moved.find(m => m.from === 'pic.png').to).toContain(path.join('Media', 'Images'))
    // Ensure no files were actually moved
    expect(fs.existsSync(path.join(src, 'doc.pdf'))).toBe(true)
    expect(fs.existsSync(path.join(src, 'pic.png'))).toBe(true)
  })
})

