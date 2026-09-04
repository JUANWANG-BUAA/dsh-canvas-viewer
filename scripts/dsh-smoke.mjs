#!/usr/bin/env node
/**
 * Real DSH web composition smoke for dsh-canvas-viewer.
 *
 * Boots a real DeepSeek Harness web profile with this plugin installed via
 * the community-standard `dsh plugin add` flow, then verifies that:
 *
 *   1. the composed host exposes `/api/canvas/list`;
 *   2. the Web boot graph serves a `/plugins/...` combo containing this
 *      package's external client factory.
 *
 * This is a seam-drift alarm for webServer plugin host loading and the dsh
 * external-factory client protocol. Harness 0.1.2 groups client factories
 * into immutable combo scripts, so the old per-package client URL is no
 * longer a stable public contract.
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

function browserSessionCookie(response) {
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean)
  return setCookies.map(value => value.split(';', 1)[0]).join('; ')
}

function redactLaunchUrls(value) {
  return value.replace(/\?token=[^\s]+/g, '?token=<redacted>')
}

async function waitForBrowserSession(getBootLog, exited = () => null) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (exited() !== null) throw new Error('server exited during boot')
    const launchUrl = getBootLog().match(/dsh web:\s+(https?:\/\/\S+)/)?.[1]
    if (launchUrl) {
      try {
        const response = await fetch(launchUrl, { redirect: 'manual' })
        const cookie = browserSessionCookie(response)
        if (response.status === 303 && cookie) {
          return { base: new URL(launchUrl).origin, cookie }
        }
      } catch {
        // the server can print its URL just before the auth route is ready
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('server did not expose an authenticated browser session within 120s')
}

function pluginScriptUrls(html) {
  return [...new Set(
    [...html.matchAll(/\/plugins\/[^"'<>\s]+/g)]
      .map((match) => match[0].replaceAll('&amp;', '&')),
  )]
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
  await dsh(['plugin', '--profile', 'web', 'add', join(HARNESS_DIR, 'packages/bundle/web-app')])
  await dsh(['plugin', '--profile', 'web', 'add', pluginSource])

  // 3. Boot the real composition.
  const server = spawn('pnpm', ['dsh', 'web', '--no-open', '--port', PORT], {
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
    let browser
    try {
      browser = await waitForBrowserSession(() => bootLog.join(''), () => exited)
    } catch (error) {
      const tail = redactLaunchUrls(bootLog.join('').split('\n').slice(-20).join('\n'))
      if (tail) console.error(`[dsh-smoke] boot log:\n${tail}`)
      throw error
    }
    if (exited !== null) {
      console.error(`[dsh-smoke] server exited during boot (code ${exited}):\n${redactLaunchUrls(bootLog.join('').split('\n').slice(-20).join('\n'))}`)
      process.exit(1)
    }

    const request = (url) => fetch(url, { headers: { cookie: browser.cookie } })
    const list = await request(`${browser.base}/api/canvas/list`)
    if (!list.ok) throw new Error(`GET /api/canvas/list expected 200, got ${list.status}: ${await list.text().catch(() => '')}`)
    const listed = await list.json()
    if (!Array.isArray(listed.items)) throw new Error('GET /api/canvas/list response has no items array')

    const index = await request(browser.base)
    if (!index.ok) throw new Error(`GET / expected 200, got ${index.status}`)
    const indexHtml = await index.text()
    if (!indexHtml.includes('__DSH_BOOT__') || !indexHtml.includes('window.__ModuleLoader__')) {
      throw new Error('web index does not contain the DSH client boot graph')
    }
    const scripts = pluginScriptUrls(indexHtml)
    let clientBytes = 0
    let foundFactory = false
    for (const script of scripts) {
      const client = await request(new URL(script, browser.base))
      if (!client.ok) throw new Error(`GET ${script} expected 200, got ${client.status}`)
      const clientText = await client.text()
      if (clientText.includes('dsh-canvas-viewer')) {
        clientBytes = Buffer.byteLength(clientText)
        foundFactory = true
        break
      }
    }
    if (!foundFactory) throw new Error(`web boot graph did not serve a dsh-canvas-viewer factory (checked ${scripts.length} plugin scripts)`)

    console.log(`[dsh-smoke] OK canvas host list=${listed.count ?? '?'}, client combo bytes=${clientBytes}`)
  } finally {
    kill()
    await new Promise(resolve => setTimeout(resolve, 250))
  }
}

main().catch(error => {
  console.error('[dsh-smoke] FAIL', error)
  process.exit(1)
})
