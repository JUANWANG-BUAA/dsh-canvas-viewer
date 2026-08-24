#!/usr/bin/env node
/**
 * Real DSH web composition smoke for dsh-canvas-viewer.
 *
 * Boots a real DeepSeek Harness web profile with this plugin installed via
 * the community-standard `dsh plugin add` flow, then verifies that:
 *
 *   1. the composed host exposes `/api/canvas/list`;
 *   2. the external client bundle is served at `/plugins/dsh-canvas-viewer/client.js`.
 *
 * This is a seam-drift alarm for webServer plugin host loading and the dsh
 * external-factory client protocol.
 *
 * Environment:
 *   HARNESS_DIR  path to an installed deepseek-harness checkout (required)
 *   DSH_HOME     temp home for the smoke profile (required)
 *   PORT         main DeepSeek Harness web port (default 3299)
 *   PACK_PLUGIN  set to 1 to install the packed npm tarball (default 0)
 *
 * Usage (from the plugin repo root):
 *   DSH_HOME=$(mktemp -d) HARNESS_DIR=../deepseek-harness node scripts/dsh-smoke.mjs
 */
import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_DIR = join(fileURLToPath(import.meta.url), '..', '..')
const HARNESS_DIR = process.env.HARNESS_DIR
const DSH_HOME = process.env.DSH_HOME
const PORT = process.env.PORT ?? '3299'
const BASE = `http://127.0.0.1:${PORT}`

if (HARNESS_DIR === undefined || DSH_HOME === undefined) {
  console.error('[dsh-smoke] HARNESS_DIR and DSH_HOME are required.')
  process.exit(2)
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}`))
    })
  })
}

async function dsh(args) {
  await run('pnpm', ['dsh', ...args], { cwd: HARNESS_DIR })
}

async function waitForBoot(exited = () => null) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (exited() !== null) throw new Error('server exited during boot')
    try {
      const response = await fetch(BASE, { redirect: 'manual' })
      if (response.status < 500) return
    } catch {
      // not up yet
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('server did not boot within 120s')
}

async function main() {
  // 1. Build the plugin, then install through the same flow users use.
  await run('pnpm', ['run', 'build:host'], { cwd: PLUGIN_DIR })
  let pluginSource = PLUGIN_DIR
  if (process.env.PACK_PLUGIN === '1') {
    const packDir = join(DSH_HOME, 'plugin-pack')
    await run('pnpm', ['pack', '--pack-destination', packDir], { cwd: PLUGIN_DIR })
    const archives = (await readdir(packDir)).filter(file => file.endsWith('.tgz'))
    if (archives.length !== 1) throw new Error(`expected one plugin tarball, found ${archives.length}`)
    pluginSource = join(packDir, archives[0])
  }

  // 2. Community-standard install: web-app bundle first, then this plugin.
  await dsh(['plugin', '--profile', 'smoke', 'add', join(HARNESS_DIR, 'packages/bundle/web-app')])
  await dsh(['plugin', '--profile', 'smoke', 'add', pluginSource])

  // 3. Boot the real composition.
  const server = spawn('pnpm', ['dsh', '--profile', 'smoke', '--no-open', '--port', PORT], {
    cwd: HARNESS_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  let exited = null
  const bootLog = []
  server.once('exit', code => { exited = code })
  server.stderr.on('data', chunk => bootLog.push(String(chunk)))
  server.stdout.on('data', chunk => bootLog.push(String(chunk)))
  const kill = () => {
    try { process.kill(-server.pid, 'SIGTERM') } catch { /* already gone */ }
  }
  try {
    await waitForBoot(() => exited)
    if (exited !== null) {
      console.error(`[dsh-smoke] server exited during boot (code ${exited}):\n${bootLog.join('').split('\n').slice(-20).join('\n')}`)
      process.exit(1)
    }

    const list = await fetch(`${BASE}/api/canvas/list`)
    if (!list.ok) throw new Error(`GET /api/canvas/list expected 200, got ${list.status}: ${await list.text().catch(() => '')}`)
    const listed = await list.json()
    if (!Array.isArray(listed.items)) throw new Error('GET /api/canvas/list response has no items array')

    const client = await fetch(`${BASE}/plugins/dsh-canvas-viewer/client.js`)
    if (!client.ok) throw new Error(`GET /plugins/dsh-canvas-viewer/client.js expected 200, got ${client.status}`)
    const clientText = await client.text()
    if (!clientText.includes('dsh-canvas-viewer')) throw new Error('client bundle does not contain the dsh-canvas-viewer factory marker')

    console.log(`[dsh-smoke] OK canvas host list=${listed.count ?? '?'}, client bytes=${Buffer.byteLength(clientText)}`)
  } finally {
    kill()
    await new Promise(resolve => setTimeout(resolve, 250))
  }
}

main().catch(error => {
  console.error('[dsh-smoke] FAIL', error)
  process.exit(1)
})
