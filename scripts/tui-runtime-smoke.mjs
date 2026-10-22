#!/usr/bin/env node
/**
 * Optional installed-runtime integration test (not part of pnpm test).
 * Run: DSH_TUI_PACKAGE=/path/to/installed/dsh-tui node scripts/tui-runtime-smoke.mjs
 * PRIVATE 0.16.1 integration fixture: host-owned getHostAdmissionForTest admits
 * the exact repository manifest to the wrapper's actual Cordis activation before
 * plugin apply. This is NOT production loader, CLI boot, or rendered UI evidence.
 * Production plugin code never receives the admission capability. A separate
 * scenario below uses the actual Cordis Loader and production admission-loader
 * (armed before the package export row); neither scenario proves CLI/UI boot.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = fileURLToPath(import.meta.url);
const repo = resolve(dirname(script), '..');
const CHILD = '--isolated-runtime-child';
const packageInput = process.env.DSH_TUI_PACKAGE;
assert(packageInput, 'DSH_TUI_PACKAGE is required: point it at an installed dsh-tui 0.16.1 package directory');
const packageDir = realpathSync(resolve(packageInput));
const packageJson = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
assert.equal(packageJson.name, '@deepseek-harness-tui/dsh-tui');
assert.equal(packageJson.version, '0.16.1', 'PRIVATE fixture is pinned to installed TUI 0.16.1');

if (!process.argv.includes(CHILD)) {
  const temporaryRoot = realpathSync(mkdtempSync(join(tmpdir(), 'canvas-tui-runtime-')));
  try {
    const home = join(temporaryRoot, 'home');
    mkdirSync(home);
    // Deliberately do not forward user config, credentials, NODE_OPTIONS, adapter
    // mode, or grants. All runtime writes/pollers are confined to this fake HOME.
    const child = spawnSync(process.execPath, ['--expose-internals', script, CHILD], {
      cwd: home,
      env: {
        PATH: process.env.PATH || '',
        HOME: home, USERPROFILE: home, DSH_HOME: join(home, '.dsh'),
        XDG_CONFIG_HOME: join(home, '.config'), XDG_CACHE_HOME: join(home, '.cache'),
        DSH_TUI_PACKAGE: packageDir, DSH_TUI_ADAPTER_MODE: 'legacy',
        NO_COLOR: '1', DO_NOT_TRACK: '1',
      },
      encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
    });
    if (child.stdout) process.stdout.write(child.stdout);
    if (child.stderr) process.stderr.write(child.stderr);
    assert.ifError(child.error);
    assert.equal(child.signal, null, 'isolated runtime subprocess must settle without a signal');
    assert.equal(child.status, 0, 'isolated runtime subprocess must pass');
  } finally {
    assert(temporaryRoot.startsWith(realpathSync(tmpdir()) + sep + 'canvas-tui-runtime-'));
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
} else {
  await exerciseInstalledRuntime();
}

async function exerciseInstalledRuntime() {
  assert.equal(realpathSync(homedir()), realpathSync(process.cwd()));
  // Resolve HOST Cordis and commands from the installed TUI, never from this
  // repository's devDependency: activation identity depends on module identity.
  const hostRequire = createRequire(join(packageDir, 'package.json'));
  const fromHost = name => import(pathToFileURL(hostRequire.resolve(name)).href);
  const internal = name => import(pathToFileURL(join(packageDir, 'lib/types/dsh-adapter', name)).href);
  const { Context } = await fromHost('@deepseek-ai/cordis');
  const { CommandRuntime } = await fromHost('@deepseek-ai/dsh-commands');
  const { TuiSceneRuntime, getHostSceneRuntime } = await internal('scenes.js');
  const { TuiPluginHostRuntime, getHostAdmissionForTest } = await internal('plugin-host.js');
  const plugin = await import(pathToFileURL(join(repo, 'lib/tui/index.mjs')).href);
  const manifestText = readFileSync(join(repo, 'dsh-plugin.json'), 'utf8');
  const canvasDir = join(homedir(), '.dsh', 'canvases');
  mkdirSync(canvasDir, { recursive: true });
  const valid = join(canvasDir, 'valid.canvas.json');
  const invalid = join(canvasDir, 'invalid.canvas.json');
  copyFileSync(join(repo, 'fixtures/dual-reader.canvas.json'), valid);
  writeFileSync(invalid, '{"schemaVersion":999,"sections":[]}');

  // Test-only timer observer; retain the native timers and native semantics.
  // Only timers created by the production plugin entry are counted.
  const timers = new Set();
  const nativeSet = globalThis.setTimeout;
  const nativeClear = globalThis.clearTimeout;
  globalThis.setTimeout = function (callback, delay, ...args) {
    const owned = new Error().stack?.includes('/lib/tui/index.mjs');
    let timer;
    timer = nativeSet(function (...values) {
      timers.delete(timer);
      return callback(...values);
    }, delay, ...args);
    if (owned) timers.add(timer);
    return timer;
  };
  globalThis.clearTimeout = function (timer) { timers.delete(timer); return nativeClear(timer); };

  const ctx = new Context();
  const fibers = [];
  try {
    fibers.push(await ctx.plugin(CommandRuntime));
    fibers.push(await ctx.plugin(TuiSceneRuntime));
    fibers.push(await ctx.plugin(TuiPluginHostRuntime));
    const commands = ctx.get('commands', false);
    const sceneHost = getHostSceneRuntime(ctx.get('tuiScenes', false));
    const admission = getHostAdmissionForTest(ctx.get('tuiPluginHost', false));
    assert(commands && sceneHost && admission, 'real host services must be mounted');
    let admitted = 0;
    let capturedCtx;
    const mount = async (admit = true) => {
      const wrapper = {
        name: 'canvas-installed-runtime-fixture', inject: plugin.inject,
        apply(pluginCtx) {
          capturedCtx = pluginCtx;
          if (admit) {
            // Host-driver-only PRIVATE test seam, exact unmodified manifest.
            const identity = admission.admit(pluginCtx, manifestText);
            assert.equal(identity.componentId, 'dsh-canvas-viewer');
            admitted++;
          }
          plugin.apply(pluginCtx);
        },
      };
      const fiber = await ctx.plugin(wrapper);
      fibers.push(fiber);
      assert(capturedCtx && capturedCtx !== ctx, 'capture actual non-root activation');
      return fiber;
    };
    const assertEmpty = () => {
      assert.equal(commands.find(undefined, 'canvas'), undefined);
      assert.equal(commands.list(undefined).filter(item => item.name === 'canvas').length, 0);
      assert.equal(sceneHost.list().length, 0);
      assert.equal(sceneHost.active, undefined);
      assert.equal(timers.size, 0, 'plugin retry timers must be released');
    };
    assertEmpty();

    // Actual unadmitted activation must not self-admit or fall back to raw
    // command registration. Its pending retry is exercised and then cancelled.
    const pending = await mount(false);
    assert.equal(commands.find(undefined, 'canvas'), undefined);
    assert.equal(sceneHost.list().length, 0);
    assert.equal(timers.size, 1, 'unadmitted registration schedules a bounded retry');
    await pending.dispose();
    assertEmpty();

    for (let cycle = 0; cycle < 2; cycle++) {
      const fiber = await mount();
      const definition = commands.find(undefined, 'canvas');
      assert(definition, 'actual host.registerCommand must reach actual commands.find');
      assert.equal(commands.list(undefined).filter(item => item.name === 'canvas').length, 1);
      assert.equal(sceneHost.list().length, 1);
      assert.equal(sceneHost.list()[0].id, 'canvas-viewer');
      assert.equal(timers.size, 0);
      const invoke = rawInput => definition.handler({ rawInput });
      assert.equal((await invoke('')).kind, 'success');
      const scene = sceneHost.active;
      assert.equal(scene?.id, 'canvas-viewer', 'handler opens the real registered scene');
      const store = observeSceneStore(scene.component);
      const before = store.getSnapshot().request;
      assert.equal((await invoke('"' + valid + '"')).kind, 'success');
      assert.equal(store.getSnapshot().path, valid);
      assert.equal(store.getSnapshot().request, before + 1);
      assert.equal((await invoke(valid)).kind, 'success');
      assert.equal(store.getSnapshot().request, before + 2, 'same-path request must notify again');
      assert.equal(sceneHost.active, scene, 'repeated request must not duplicate scene');
      const snapshot = store.getSnapshot();
      for (const path of [invalid, join(homedir(), 'missing.canvas.json'), join(repo, 'fixtures/dual-reader.canvas.json'), 'bad.txt']) {
        const result = await invoke(path);
        assert.equal(result.kind, 'error', 'invalid or denied file must return CommandResult error');
        assert(result.text.length > 0);
        assert.equal(store.getSnapshot(), snapshot, 'failed request must not mutate selection');
        assert.equal(sceneHost.active, scene);
      }
      let notifications = 0;
      store.subscribe(() => notifications++);
      assert.equal((await invoke(valid)).kind, 'success');
      assert.equal(notifications, 1);
      await fiber.dispose();
      assertEmpty();
      await assert.rejects(store.open(valid), /disposed/);
      await assert.rejects(store.list(), /disposed/);
      assert.throws(() => store.requestOpen(valid), /disposed/);
      assert.equal(notifications, 1, 'disposed store must not notify retained subscribers');
      const stale = await invoke(valid);
      assert.equal(stale.kind, 'error', 'retained old handler must not reopen after unload');
      assertEmpty();
    }
    assert.equal(admitted, 2);
    await exerciseProductionAdmissionLoader();
    console.log(JSON.stringify({
      ok: true, tuiVersion: packageJson.version, adapterMode: 'legacy', cycles: 2,
      privateFixture: 'PRIVATE 0.16.1 integration fixture; NOT production loader evidence',
      coverage: ['exact-manifest host admission', 'real Cordis activation', 'real registerCommand/find/handler',
        'real scene open', 'invalid and outside-HOME file errors', 'repeated same-path request',
        'unadmitted retry cancellation', 'fiber unload command/scene/store/timer cleanup', 'reload without duplicates'],
      productionLoader: ['real Cordis Loader package export row', 'nearest package manifest ownership',
        'cold arm before row', 'unload/reload without duplicate command or scene'],
      notCovered: ['CLI/profile boot', 'terminal UI rendering', 'live grant revocation',
        'late-arm catch-up: installed host did not admit already ACTIVE row in exploratory test'],
    }, null, 2));
  async function exerciseProductionAdmissionLoader() {
    const { Loader } = await fromHost('@deepseek-ai/cordis-plugin-loader');
    const { armAdmissionLoader, resolveEntryUrl, findManifest } = await internal('admission-loader.js');
    const { componentIdentityOf } = await internal('component-identity.js');
    // A second actual composition: no wrapper apply and no PRIVATE admission.
    // Loader.write() is the upstream in-memory no-op, not a user profile writer.
    {
      const root = new Context();
      const providers = [];
      let entry;
      let loader;
      try {
        providers.push(await root.plugin(Loader, { baseUrl: pathToFileURL(join(repo, 'package.json')).href }));
        providers.push(await root.plugin(CommandRuntime));
        providers.push(await root.plugin(TuiSceneRuntime));
        providers.push(await root.plugin(TuiPluginHostRuntime));
        loader = root.get('loader', false);
        assert(loader.internal, 'real loader must expose its own Node ESM resolver');
        const specifier = 'dsh-canvas-viewer/tui';
        const url = resolveEntryUrl(loader, specifier, pathToFileURL(join(repo, 'package.json')).href);
        assert.equal(url, pathToFileURL(join(repo, 'lib/tui/index.mjs')).href);
        assert.equal(findManifest(fileURLToPath(url)), join(repo, 'dsh-plugin.json'));
        const hostScenes = getHostSceneRuntime(root.get('tuiScenes', false));
        const registry = root.get('commands', false);
        const arm = async () => providers.push(await root.plugin({
          name: 'canvas-production-admission-loader-fixture',
          apply(hostCtx) { armAdmissionLoader(hostCtx); },
        }));
        await arm();
        const loadRow = async () => {
          const id = await loader.create({ name: specifier });
          await loader.await();
          entry = loader.resolve(id);
          assert(entry.fiber, 'actual export row must create its own fiber');
          return id;
        };
        let id = await loadRow();
        const waitForCommand = async () => {
          const deadline = Date.now() + 3000;
          while (!registry.find(undefined, 'canvas') && Date.now() < deadline)
            await new Promise(resolve => nativeSet(resolve, 20));
          assert(registry.find(undefined, 'canvas'), 'production loader admission must register command');
        };
        for (let cycle = 0; cycle < 2; cycle++) {
          await waitForCommand();
          const identity = componentIdentityOf(entry.fiber.ctx);
          assert.equal(identity?.componentId, 'dsh-canvas-viewer');
          assert.equal(registry.list(undefined).filter(item => item.name === 'canvas').length, 1);
          assert.equal(hostScenes.list().length, 1);
          assert.equal((await registry.find(undefined, 'canvas').handler({ rawInput: valid })).kind, 'success');
          assert.equal(hostScenes.active?.id, 'canvas-viewer');
          assert.equal(timers.size, 0);
          await entry.fiber.dispose();
          loader.remove(id);
          assert.equal(registry.find(undefined, 'canvas'), undefined);
          assert.equal(hostScenes.list().length, 0);
          assert.equal(hostScenes.active, undefined);
          assert.equal(timers.size, 0);
          if (cycle === 0) id = await loadRow();
        }
      } finally {
        if (entry?.fiber) await entry.fiber.dispose();
        for (const provider of providers.reverse()) await provider.dispose();
      }
    }
  }
  } finally {
    for (const fiber of fibers.reverse()) await fiber.dispose();
    globalThis.setTimeout = nativeSet;
    globalThis.clearTimeout = nativeClear;
  }
}

/** Read-only hook-boundary observer, NOT a React renderer or UI assertion.
 * The component's first useEffect dependency is its actual private store. Stop
 * before mounting effects or evaluating any UI; all store methods stay original.
 */
function observeSceneStore(component) {
  const stop = new Error('store observed');
  let store;
  try {
    component({
      React: {
        useState: initializer => [initializer(), () => {}],
        useEffect: (_effect, dependencies) => { [store] = dependencies; throw stop; },
      },
      ui: { useTerminalSize: () => ({ columns: 80, rows: 24 }) },
    });
  } catch (error) { if (error !== stop) throw error; }
  assert.equal(typeof store?.getSnapshot, 'function', 'scene must hold real store');
  return store;
}
