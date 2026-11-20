// agentgateway-budget for opencode (TUI plugin, opencode 1.19+).
// Registers /my-budget and /increase-my-budget in the "/" menu. They run the budget script locally
// and show the result in a dialog: no LLM call, no session, works while you're blocked.
import { execFile } from "node:child_process"

const SCRIPT = process.env.BUDGET_SCRIPT || "increase-my-budget"

function run(args) {
  return new Promise((resolve) => {
    execFile(SCRIPT, args, { timeout: 30_000 }, (err, stdout, stderr) => {
      const out = `${stdout ?? ""}${stderr ?? ""}`.trim()
      resolve(out || (err ? String(err.message) : "(no output)"))
    })
  })
}

function show(api, title, text) {
  api.ui.dialog.replace(() =>
    api.ui.DialogAlert({ title, message: text, onConfirm: () => api.ui.dialog.clear() }))
}

export default {
  id: "agentgateway-budget",
  tui: async (api) => {
    api.keymap.registerLayer({
      commands: [
        { name: "budget.status", title: "Show my budget", category: "Budget", namespace: "palette",
          slashName: "my-budget", desc: "Show my agentgateway budget (no LLM call)",
          async run() { show(api, "My budget", await run(["status"])) } },
        { name: "budget.increase", title: "Increase my budget", category: "Budget", namespace: "palette",
          slashName: "increase-my-budget", desc: "Borrow from the team pool (no LLM call)",
          async run() { show(api, "Increase my budget", await run([])) } },
      ],
    })
  },
}
