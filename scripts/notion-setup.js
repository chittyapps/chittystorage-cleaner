#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const Notion = require('../src/integrations/notion')

async function main(){
  const ROOT = path.join(__dirname, '..')
  const DATA = path.join(ROOT, 'data')
  fs.mkdirSync(DATA, { recursive: true })
  const notion = new Notion({})
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_PARENT_PAGE_ID) {
    console.error('Please export NOTION_API_KEY and NOTION_PARENT_PAGE_ID.')
    process.exit(1)
  }
  const { alertsDbId, actionsDbId, statusDbId } = await notion.createDatabasesUnderParent()
  const page = await notion.createDashboardPage({ alertsDbId, actionsDbId, statusDbId })
  const cfg = { alertsDbId, actionsDbId, statusDbId, dashboardPageId: page.id }
  fs.writeFileSync(path.join(DATA, 'notion.json'), JSON.stringify(cfg, null, 2))
  console.log(JSON.stringify(cfg, null, 2))
}

main().catch(err => { console.error('Error:', err.response?.data || err.message); process.exit(1) })
