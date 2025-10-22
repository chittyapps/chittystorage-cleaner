#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const axios = require('axios')

const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'data')
const THREAD_FILE = path.join(DATA, 'chatgpt-thread.txt')

async function main(){
  const key = process.env.OPENAI_API_KEY
  const assistantId = process.env.OPENAI_ASSISTANT_ID
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  if(!key || !assistantId){
    console.error('Set OPENAI_API_KEY and OPENAI_ASSISTANT_ID first.');
    process.exit(1)
  }
  let threadId = process.env.OPENAI_THREAD_ID
  if(!threadId){
    try { if(fs.existsSync(THREAD_FILE)) threadId = fs.readFileSync(THREAD_FILE,'utf8').trim() } catch(_){}
  }
  const headers = { Authorization: `Bearer ${key}` }
  if(!threadId){
    const resp = await axios.post(`${base}/threads`, {}, { headers })
    threadId = resp.data.id
    fs.mkdirSync(DATA, { recursive: true })
    fs.writeFileSync(THREAD_FILE, threadId)
  }
  console.log(JSON.stringify({ assistantId, threadId, stored: THREAD_FILE }, null, 2))
}

main().catch(err=>{ console.error('Error:', err.message); process.exit(1) })

