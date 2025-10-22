const axios = require('axios')

class CloudflareAI {
  constructor (opts = {}) {
    this.accountId = opts.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || null
    this.apiToken = opts.apiToken || process.env.CLOUDFLARE_API_TOKEN || null
    this.vectorIndex = opts.vectorIndex || process.env.CF_VECTORIZE_INDEX || null
    this.base = 'https://api.cloudflare.com/client/v4'
    this.modelText = opts.modelText || process.env.CF_AI_TEXT_MODEL || '@cf/meta/llama-3.1-8b-instruct'
  }

  updateConfig (cfg) {
    try {
      const cf = (cfg && cfg.integrations && cfg.integrations.cloudflare) || {}
      this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || cf.accountId || this.accountId
      this.apiToken = process.env.CLOUDFLARE_API_TOKEN || cf.apiToken || this.apiToken
      this.vectorIndex = process.env.CF_VECTORIZE_INDEX || cf.vectorIndex || this.vectorIndex
      this.modelText = process.env.CF_AI_TEXT_MODEL || cf.modelText || this.modelText
    } catch (_) {}
  }

  get configured () { return !!(this.accountId && this.apiToken && this.vectorIndex) }

  get headers () { return { Authorization: `Bearer ${this.apiToken}`, 'Content-Type': 'application/json' } }

  async status () {
    if (!this.configured) return { ok: false, reason: 'not_configured' }
    try {
      // Vectorize index info (not all accounts expose; we simply return configured)
      return { ok: true, index: this.vectorIndex }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  async queryText (_text, _topK = 5) {
    // Placeholder: requires an embedding step; for now return empty when configured
    if (!this.configured) return []
    return []
  }

  async runTextModel (prompt, systemPrompt) {
    if (!this.accountId || !this.apiToken || !this.modelText) throw new Error('Cloudflare AI not configured')
    const model = encodeURIComponent(this.modelText)
    const url = `${this.base}/accounts/${this.accountId}/ai/run/${model}`
    const body = systemPrompt ? { messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }] } : { messages: [{ role: 'user', content: prompt }] }
    const res = await axios.post(url, body, { headers: this.headers, timeout: 6000 }).then(r => r.data).catch(e => { throw new Error((e.response && e.response.data && JSON.stringify(e.response.data)) || e.message) })
    // Cloudflare AI returns { result: { response: '...' } } for instruct models
    const text = res && (res.result?.response || res.result?.output_text || res.response || '')
    return String(text || '').trim()
  }

  async summarize (text) {
    const sys = 'You are a helpful assistant. Summarize the text briefly (max 2 sentences).'
    const prompt = `Text:\n${text.slice(0, 6000)}`
    return this.runTextModel(prompt, sys)
  }

  async categorize (text, categories) {
    const cats = categories && categories.length ? categories : ['Financial/Receipts','Financial/Bills','Financial/Invoices','Legal/Contracts','Communications','Evidence','Documents','Business','Personal']
    const sys = 'Classify the text into one of the provided categories. Output JSON: {"category":"<one>","confidence":0-1}'
    const prompt = `Categories: ${cats.join(', ')}\nText:\n${text.slice(0, 6000)}\nJSON:`
    const out = await this.runTextModel(prompt, sys)
    try { const j = JSON.parse(out); if (j && j.category) return { category: String(j.category), confidence: Number(j.confidence || 0.6) } } catch (_) {}
    // fallback: naive keyword
    const lower = text.toLowerCase()
    const find = (k, c) => lower.includes(k) ? c : null
    const guess = find('invoice','Financial/Invoices') || find('receipt','Financial/Receipts') || find('contract','Legal/Contracts') || 'Documents'
    return { category: guess, confidence: 0.4 }
  }
}

module.exports = CloudflareAI
