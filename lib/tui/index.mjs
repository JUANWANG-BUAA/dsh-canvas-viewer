import { createCanvasStore } from "./store.mjs";
import { createCanvasScene } from "./reader.mjs";

export const name = "canvas-viewer-tui";
export const inject = ["tuiScenes", "commands"];
export const CANVAS_SCENE_ID = "canvas-viewer";
export const CANVAS_COMMAND_ID = "canvas.viewer.open";
const safeError = error => String(error?.message || error).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ").slice(0, 500);
export function apply(ctx) {
  const store = createCanvasStore();
  const component = createCanvasScene(store);
  // Admission is loader-owned and may finish after this activation's apply.
  // Never call admit(), bypass commands attribution or start an unbounded retry.
  ctx.effect(() => {
    let disposed = false, timer, tries = 0;
    let releaseCommand, releaseScene;
    const stop = () => {
      disposed = true; clearTimeout(timer);
      releaseScene?.(); releaseCommand?.(); store.dispose();
    };
    const register = () => {
      if (disposed) return;
      try {
        const host = ctx.get("tuiPluginHost", false);
        if (!host || typeof host.registerCommand !== "function") {
          if (++tries < 100) { timer = setTimeout(register, 200); timer.unref?.(); return; }
          throw new Error("tuiPluginHost unavailable; requires dsh-tui 0.16.1 admission profile");
        }
        releaseCommand = host.registerCommand(ctx, CANVAS_COMMAND_ID, {
          name: "canvas", description: "Canvas 图库与终端只读报告", input: { hint: "[path.canvas.json]" },
          async handler({ rawInput = "" }) {
            try {
              if (disposed) throw new Error("Canvas reader disposed");
              let path = rawInput.trim();
              if (path && ((path.startsWith('"') && path.endsWith('"')) || (path.startsWith("'") && path.endsWith("'")))) path = path.slice(1, -1);
              if (path) { const opened = await store.open(path); if (disposed) throw new Error("Canvas reader disposed"); path = opened.path; }
              if (!ctx.tuiScenes.open(CANVAS_SCENE_ID)) throw new Error("Canvas scene unavailable");
              store.requestOpen(path || undefined);
              return { kind: "success" };
            } catch (error) { return { kind: "error", text: "Canvas: " + safeError(error) }; }
          },
        });
        try { releaseScene = ctx.tuiScenes.register({ id: CANVAS_SCENE_ID, title: "Canvas 报告", component }, ctx); }
        catch (error) { releaseCommand?.(); releaseCommand = undefined; throw error; }
      } catch (error) {
        if (error?.code === "COMPONENT_NOT_ADMITTED" && ++tries < 100) { timer = setTimeout(register, 200); timer.unref?.(); return; }
        ctx.logger?.warn("Canvas TUI 未激活：" + safeError(error));
      }
    };
    register();
    return stop;
  }, "canvas-viewer-tui: scene, command and store");
}
