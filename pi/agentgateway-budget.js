// agentgateway-budget for pi: /my-budget and /increase-my-budget
// Native slash commands: they run the agentgateway budget script directly, WITHOUT an LLM turn, so they
// (a) cost no budget, (b) still work when you're already blocked, (c) can't be refused by the model.
// The script authenticates to agentgateway with your own agw-ent key; agw RBAC decides what you may do.
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(homedir(), ".pi", "agent", "bin", "increase-my-budget");

// Inside pi, the agw-ent provider is the source of truth. Without this, an unrelated OPENAI_API_KEY or
// ANTHROPIC_AUTH_TOKEN in the shell would win in the script's lookup order and be sent to the gateway (401).
function piEnv() {
  const env = { ...process.env };
  if (env.AGW_KEY || env.AGW_API_KEY) return env;
  try {
    const p = JSON.parse(readFileSync(join(homedir(), ".pi", "agent", "models.json"), "utf8")).providers["agw-ent"];
    if (p?.apiKey) env.AGW_KEY = p.apiKey;
    if (p?.baseUrl && !env.AGW_URL) env.AGW_URL = p.baseUrl;
  } catch {}
  return env;
}

function run(args, ctx) {
  return new Promise((resolve) =>
    execFile(SCRIPT, args, { timeout: 20000, env: piEnv() }, (err, stdout, stderr) => {
      const code = err ? (err.code ?? 1) : 0;
      const out = `${stdout}${stderr}`.trim() || `exited with ${code}`;
      ctx.ui.notify(out, code === 0 ? "info" : code === 2 ? "warning" : "error");
      if (!ctx.hasUI) process.stdout.write(`${out}\n`);
      resolve();
    }));
}

export default function (pi) {
  pi.registerCommand("my-budget", {
    description: "Show my agentgateway budget and my team pool (no LLM call)",
    handler: async (_args, ctx) => run(["status"], ctx),
  });
  pi.registerCommand("increase-my-budget", {
    description: "Borrow from the team budget pool via agentgateway (no LLM call)",
    handler: async (_args, ctx) => run([], ctx),
  });
}
