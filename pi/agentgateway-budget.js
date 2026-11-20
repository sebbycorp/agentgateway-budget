// agentgateway-budget for pi: /my-budget and /increase-my-budget
// Native slash commands: they run the agentgateway budget script directly, WITHOUT an LLM turn, so they
// (a) cost no budget, (b) still work when you're already blocked, (c) can't be refused by the model.
// The script authenticates to agentgateway with your own agw-ent key; agw RBAC decides what you may do.
import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(homedir(), ".pi", "agent", "bin", "increase-my-budget");

function run(args, ctx) {
  return new Promise((resolve) =>
    execFile(SCRIPT, args, { timeout: 20000 }, (err, stdout, stderr) => {
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
