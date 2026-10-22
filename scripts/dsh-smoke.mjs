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
 * longer a stable public contract. Harness 0.2 emits those combo references
 * as document-relative `plugins/...` URLs (`src="plugins/??..."`) instead of
 * root-absolute `/plugins/...`, so the scan accepts both spellings.
 *
 * Environment:
 *   HARNESS_DIR  path to an installed deepseek-harness checkout
 *   DSH_BIN      optional absolute installed CLI; replaces checkout invocation
 *                and uses its bundled web profile (HARNESS_DIR then optional)
 *   DSH_HOME     temp home for the smoke profile (required)
 *   PORT         main DeepSeek Harness web port (default 3299)
 *   PACK_PLUGIN  set to 1 to install the packed npm tarball (default 0)
 *   DSH_BROWSER_SMOKE  set to 1 for real runtime/iframe/edit-save UI checks
 *   CANVAS_CDP_URL  optional loopback CDP endpoint; creates a fresh context,
 *                   never uses existing tabs, cookies or persistent profiles
 * Browser mode requires Playwright + installed Chromium (no implicit download),
 * an empty DSH_HOME, and uses a managed temporary HOME for all plugin storage.
 * Browser validation has a 90s deadline; boot is bounded at 120s. No auth URLs,
 * raw logs, cookies, headers, traces or screenshots are emitted. DSH_HOME is
 * caller-owned and retained; only the managed HOME is removed on normal exit.
 *
 * Usage (from the plugin repo root):
 *   DSH_HOME=$(mktemp -d) HARNESS_DIR=../deepseek-harness node scripts/dsh-smoke.mjs
 *   DSH_BROWSER_SMOKE=1 DSH_HOME=$(mktemp -d) HARNESS_DIR=../deepseek-harness node scripts/dsh-smoke.mjs
 */
import { spawn } from 'node:child_process'
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_DIR = join(fileURLToPath(import.meta.url), '..', '..')
const HARNESS_DIR = process.env.HARNESS_DIR
const DSH_BIN = process.env.DSH_BIN
const DSH_HOME = process.env.DSH_HOME && resolve(process.env.DSH_HOME)
const BROWSER_SMOKE = process.env.DSH_BROWSER_SMOKE === '1'
let testHome
let dshEnv = process.env
const PORT = process.env.PORT ?? '3299'

if ((!HARNESS_DIR && !DSH_BIN) || !DSH_HOME || (DSH_BIN && !isAbsolute(DSH_BIN))) {
  console.error('[dsh-smoke] DSH_HOME and either HARNESS_DIR or an absolute DSH_BIN are required.')
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
  await run(DSH_BIN || 'pnpm', DSH_BIN ? args : ['dsh', ...args], { cwd: HARNESS_DIR || PLUGIN_DIR, env: dshEnv })
}

function browserSessionCookie(response) {
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean)
  return setCookies.map(value => value.split(';', 1)[0]).join('; ')
}

async function waitForBrowserSession(getBootLog, exited = () => null) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (exited() !== null) throw new Error('server exited during boot')
    const launchUrl = getBootLog().match(/dsh web:\s+(https?:\/\/\S+)/)?.[1]
    if (launchUrl) {
      try {
        const response = await fetch(launchUrl, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
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
  // Accept both the root-absolute form (`/plugins/??...`, 0.1.x) and the
  // document-relative form (`plugins/??...`, 0.2) that the index emits.
  return [...new Set(
    [...html.matchAll(/(?:\.\/|\/)?plugins\/[^"'<>\s]+/g)]
      .map((match) => match[0].replaceAll('&amp;', '&')),
  )]
}

// Browser mode never opens an existing profile or executes report code in the host page.
// The only injected DOM is a test-owned link exercising the plugin's existing click path.
async function validateBrowser(session, fixturePath, source) {
  let browser
  let context
  let stage = 'load Playwright (install chromium with pnpm exec playwright install chromium)'
  let deadline
  try {
    await Promise.race([(async () => {
    // Playwright debug/protocol logging can include cookies and request bodies.
    delete process.env.DEBUG
    delete process.env.PWDEBUG
    const { chromium } = await import('playwright')
    stage = 'connect disposable browser context'
    if (process.env.CANVAS_CDP_URL) {
      const endpoint = new URL(process.env.CANVAS_CDP_URL)
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(endpoint.protocol)
        || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)
        || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
        throw new Error('CDP must be a credential-free loopback endpoint')
      }
      browser = await chromium.connectOverCDP(endpoint.href, { timeout: 15_000 })
    } else {
      browser = await chromium.launch({ headless: true, timeout: 15_000 })
    }
    // Never browser.contexts()[0]: even CDP uses a new off-the-record context.
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    context.setDefaultTimeout(15_000)
    context.setDefaultNavigationTimeout(20_000)
    await context.addCookies(session.cookie.split('; ').map(pair => {
      const equals = pair.indexOf('=')
      return { name: pair.slice(0, equals), value: pair.slice(equals + 1),
        url: session.base, httpOnly: true, sameSite: 'Lax' }
    }))
    const page = await context.newPage()
    stage = 'authenticated runtime activation'
    // The one-time launch URL was consumed by Node; it is never sent to Playwright.
    const response = await page.goto(session.base, { waitUntil: 'domcontentloaded' })
    if (!response?.ok()) throw new Error('index rejected')
    await page.locator('#dsh-canvas-viewer-css').waitFor({ state: 'attached' })
    await page.locator('[data-dsh-canvas-viewer] [data-dsh-cv-idle]').waitFor({ state: 'attached' })

    stage = 'authenticated fixture open'
    const opened = await context.request.post(session.base + '/api/canvas/open', {
      data: { path: fixturePath }, timeout: 15_000,
    })
    const payload = await opened.json()
    if (!opened.ok() || payload.ok === false || payload.error || payload.path !== fixturePath || !payload.moduleCode) {
      throw new Error('fixture open rejected')
    }
    await page.evaluate(path => {
      const anchor = document.createElement('a')
      anchor.id = 'dsh-smoke-fixture-link'
      anchor.href = '#'
      anchor.dataset.canvas = path
      anchor.textContent = 'Open smoke fixture'
      anchor.style.cssText = 'position:fixed;top:4px;left:4px;z-index:2147483647;background:white;color:black;padding:8px'
      document.body.appendChild(anchor)
    }, fixturePath)
    await page.locator('#dsh-smoke-fixture-link').click()
    const viewer = page.locator('[data-dsh-canvas-viewer] .dsh-cv-win')
    await viewer.waitFor({ state: 'visible' })
    const report = viewer.frameLocator('iframe[sandbox="allow-scripts"]')
    stage = 'real iframe heading render'
    await report.getByRole('heading', { name: 'DSH browser smoke fixture', exact: true }).waitFor({ state: 'visible' })

    stage = 'source edit and durable save'
    await viewer.getByRole('button', { name: '源码', exact: true }).click()
    const edited = source.replace('DSH browser smoke fixture', 'DSH browser smoke saved')
    await viewer.getByRole('textbox', { name: 'canvas 源码编辑', exact: true }).fill(edited)
    const savedResponse = page.waitForResponse(res =>
      new URL(res.url()).pathname === '/api/canvas/save' && res.request().method() === 'POST')
    await viewer.getByRole('button', { name: /^保存 / }).click()
    const saved = await savedResponse
    const savedPayload = await saved.json()
    if (!saved.ok() || savedPayload.ok === false || savedPayload.error || savedPayload.path !== fixturePath
      || await readFile(fixturePath, 'utf8') !== edited) throw new Error('save did not reach fixture disk')
    await report.getByRole('heading', { name: 'DSH browser smoke saved', exact: true }).waitFor({ state: 'visible' })

    stage = 'theme propagation and clean close'
    const light = await page.locator('html').getAttribute('data-dsh-cv-theme') === 'light'
    await viewer.getByRole('button', { name: '切换主题', exact: true }).click()
    await report.locator(light ? 'html:not([data-dsh-cv-theme="light"])' : 'html[data-dsh-cv-theme="light"]').waitFor({ state: 'attached' })
    await viewer.getByRole('button', { name: '关闭 Canvas', exact: true }).click()
    await viewer.waitFor({ state: 'detached' })
    console.log('[dsh-smoke] OK browser activation, authenticated open, iframe render, disk save, theme, close')
    })(), new Promise((_, reject) => {
      deadline = setTimeout(() => reject(new Error('browser deadline')), 90_000)
    })])
  } catch {
    // Never print Playwright errors/call logs, page console, headers, cookies,
    // response bodies, traces, screenshots or endpoint URLs: these can carry auth.
    throw new Error('browser validation failed at: ' + stage)
  } finally {
    clearTimeout(deadline)
    await context?.close().catch(() => {})
    // For connectOverCDP this disconnects; it does not close the external browser.
    await browser?.close().catch(() => {})
  }
}

async function prepareBrowserHome() {
  // DSH_HOME owns the composition; HOME owns the plugin's canvases/history.
  // Both must be disposable. Refuse an occupied profile before any install/build.
  if (!DSH_HOME || DSH_HOME === resolve(homedir()) || DSH_HOME === join(homedir(), '.dsh')) {
    throw new Error('browser smoke requires an empty disposable DSH_HOME')
  }
  await mkdir(DSH_HOME, { recursive: true })
  if ((await lstat(DSH_HOME)).isSymbolicLink() || (await readdir(DSH_HOME)).length) {
    throw new Error('browser smoke requires an empty non-symlink DSH_HOME')
  }
  testHome = await realpath(await mkdtemp(join(tmpdir(), 'dsh-browser-smoke-')))
  dshEnv = { ...process.env, DSH_HOME, HOME: testHome, USERPROFILE: testHome,
    XDG_CONFIG_HOME: join(testHome, '.config'), XDG_CACHE_HOME: join(testHome, '.cache'),
    XDG_DATA_HOME: join(testHome, '.local', 'share') }
  const fixturePath = join(testHome, '.dsh', 'canvases', 'browser-smoke.canvas.tsx')
  const source = 'import { H1 } from "dsh/canvas";\nexport default function Smoke() { return <H1>DSH browser smoke fixture</H1>; }\n'
  await mkdir(join(testHome, '.dsh', 'canvases'), { recursive: true })
  await writeFile(fixturePath, source, { flag: 'wx' })
  return { fixturePath, source }
}

async function main() {
  const fixture = BROWSER_SMOKE ? await prepareBrowserHome() : null
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
  // Installed CLI mode uses its bundled default web profile, not checkout sources.
  if (!DSH_BIN) await dsh(['plugin', '--profile', 'web', 'add', join(HARNESS_DIR, 'packages/bundle/web-app')])
  await dsh(['plugin', '--profile', 'web', 'add', pluginSource])

  // 3. Boot the real composition.
  const webArgs = ['web', '--no-open', '--port', PORT]
  const server = spawn(DSH_BIN || 'pnpm', DSH_BIN ? webArgs : ['dsh', ...webArgs], {
    cwd: HARNESS_DIR || PLUGIN_DIR,
    env: dshEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  let exited = null
  const bootLog = []
  server.once('exit', code => { exited = code ?? -1 })
  server.once('error', () => { exited = -1 })
  server.stderr.on('data', chunk => bootLog.push(String(chunk)))
  server.stdout.on('data', chunk => bootLog.push(String(chunk)))
  const kill = () => {
    try { process.kill(-server.pid, 'SIGTERM') } catch { /* already gone */ }
  }
  try {
    let browser
    try {
      browser = await waitForBrowserSession(() => bootLog.join(''), () => exited)
    } catch {
      // Do not emit raw server logs: they can contain launch URLs or headers.
      throw new Error('server failed to establish an authenticated session within 120s')
    }
    if (exited !== null) throw new Error('server exited during boot')

    const request = (url) => fetch(url, { headers: { cookie: browser.cookie }, signal: AbortSignal.timeout(15_000) })
    const list = await request(`${browser.base}/api/canvas/list`)
    if (!list.ok) throw new Error(`GET /api/canvas/list expected 200, got ${list.status}`)
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
      if (!client.ok) throw new Error(`GET plugin combo expected 200, got ${client.status}`)
      const clientText = await client.text()
      if (clientText.includes('dsh-canvas-viewer')) {
        clientBytes = Buffer.byteLength(clientText)
        foundFactory = true
        break
      }
    }
    if (!foundFactory) throw new Error(`web boot graph did not serve a dsh-canvas-viewer factory (checked ${scripts.length} plugin scripts)`)

    if (fixture) await validateBrowser(browser, fixture.fixturePath, fixture.source)
    console.log(`[dsh-smoke] OK canvas host list=${listed.count ?? '?'}, client combo bytes=${clientBytes}`)
  } finally {
    kill()
    const end = Date.now() + 3000
    while (exited === null && Date.now() < end) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    // Kill the owned process group, including children surviving pnpm's exit.
    try { process.kill(-server.pid, 'SIGKILL') } catch { /* already gone */ }
  }
}

main().catch(error => {
  // Only our browser stage text is safe; never dump a transport error/call log.
  const stage = error instanceof Error && error.message.startsWith('browser validation failed at: ')
    ? error.message : 'composition smoke failed (raw diagnostics suppressed to protect authentication)'
  console.error('[dsh-smoke] FAIL', stage)
  process.exitCode = 1
}).finally(async () => {
  // This path is the exact directory returned by mkdtemp above, never DSH_HOME.
  if (testHome) await rm(testHome, { recursive: true, force: true })
})
