const { parseByteSize, uniquePath } = require('../../src/utils/file-utils')
const fs = require('fs')
const path = require('path')

describe('file-utils', () => {
  test('parseByteSize parses common units', () => {
    expect(parseByteSize('1B')).toBe(1)
    expect(parseByteSize('1KB')).toBe(1024)
    expect(parseByteSize('2 MB')).toBe(2 * 1024 * 1024)
    expect(parseByteSize('1.5GB')).toBe(1.5 * 1024 * 1024 * 1024)
    expect(Number.isNaN(parseByteSize('bad'))).toBe(true)
  })

  test('uniquePath returns a non-colliding path', () => {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fu-'))
    const base = path.join(dir, 'file.txt')
    fs.writeFileSync(base, 'a')
    const p2 = uniquePath(base)
    expect(p2).not.toBe(base)
  })
})

