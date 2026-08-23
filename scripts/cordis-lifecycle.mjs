#!/usr/bin/env node
/**
 * Real Cordis lifecycle smoke test. This intentionally uses Context + Service
 * fibers instead of a structural `{ register() {} }` mock: the test verifies
 * Cordis dependency injection, effect disposal, and plugin reload semantics.
 */
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Context, Service } from "@deepseek-ai/cordis";
import * as pluginModule from "../lib/index.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

class TestWebServer extends Service {
  routes = [];

  constructor(ctx) {
    super(ctx, "webServer");
  }

  register(route) {
    this.routes.push(route);
    return () => {
      const index = this.routes.indexOf(route);
      if (index >= 0) this.routes.splice(index, 1);
    };
  }
}

class TestTools extends Service {
  tools = [];

  constructor(ctx) {
    super(ctx, "tools");
  }

  register(tool) {
    const add = () => {
      this.tools.push(tool);
      return () => {
        const index = this.tools.indexOf(tool);
        if (index >= 0) this.tools.splice(index, 1);
      };
    };
    return this.ctx.effect(add, "test:tool");
  }
}

class TestSystemPrompt extends Service {
  sections = [];

  constructor(ctx) {
    super(ctx, "systemPrompt");
  }

  section(section) {
    const add = () => {
      this.sections.push(section);
      return () => {
        const index = this.sections.indexOf(section);
        if (index >= 0) this.sections.splice(index, 1);
      };
    };
    return this.ctx.effect(add, "test:prompt");
  }
}

class FakeRequest extends EventEmitter {
  method = "GET";
  destroyed = false;

  constructor(url) {
    super();
    this.url = url;
  }

  destroy() {
    this.destroyed = true;
  }
}

class FakeResponse extends EventEmitter {
  headers = null;
  chunks = [];
  ended = false;

  writeHead(status, headers) {
    this.headers = { status, ...headers };
  }

  write(chunk) {
    this.chunks.push(String(chunk));
    return true;
  }

  end() {
    this.ended = true;
    this.emit("close");
  }
}

const fixture = join(process.cwd(), "fixtures", "audit-sample.canvas.tsx");
assert(readFileSync(fixture, "utf8").includes("export default"), "fixture must be a canvas module");

const ctx = new Context();
await ctx.plugin(TestWebServer);
await ctx.plugin(TestTools);
await ctx.plugin(TestSystemPrompt);
const web = ctx.get("webServer", false);
const tools = ctx.get("tools", false);
const systemPrompt = ctx.get("systemPrompt", false);
assert(web && tools && systemPrompt, "real Cordis services must be available");

const plugin = {
  name: pluginModule.name,
  inject: pluginModule.inject,
  apply: pluginModule.apply,
};

async function exerciseCycle() {
  const fiber = await ctx.plugin(plugin);
  assert(web.routes.length === 13, `expected 13 routes, got ${web.routes.length}`);
  assert(tools.tools.length === 1, `expected one tool, got ${tools.tools.length}`);
  assert(systemPrompt.sections.length === 1, "expected one system prompt section");

  const watchRoute = web.routes.find((route) => route.path === "/api/canvas/watch");
  assert(watchRoute, "watch route must be registered");
  const req = new FakeRequest(`/api/canvas/watch?path=${encodeURIComponent(fixture)}`);
  const res = new FakeResponse();
  watchRoute.handler(req, res);
  await new Promise((resolve) => setImmediate(resolve));
  assert(res.headers?.status === 200, "watch route must open an SSE response");

  await fiber.dispose();
  assert(web.routes.length === 0, "route effects must be disposed");
  assert(tools.tools.length === 0, "tool registration must be disposed");
  assert(systemPrompt.sections.length === 0, "system prompt section must be disposed");
  assert(res.ended, "plugin disposal must close the active SSE response");
}

await exerciseCycle();
await exerciseCycle();
console.log(JSON.stringify({ ok: true, cycles: 2, routes: web.routes.length, tools: tools.tools.length }));
