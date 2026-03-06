export interface AgentTool {
  name: string;
  description: string;
  parameters: string;
  execute: (args: string, context: ToolContext) => Promise<string>;
}

export interface ToolContext {
  sendPeerMessage?: (text: string) => void;
}

const calculator: AgentTool = {
  name: "calculator",
  description: "Evaluate a math expression. Returns the numeric result.",
  parameters: "expression (e.g. \"17 * 23 + 5\")",
  execute: async (args) => {
    try {
      // Safe math evaluation — only allows numbers, operators, parens, and whitespace
      const sanitized = args.trim();
      if (!/^[\d\s+\-*/().,%^]+$/.test(sanitized)) {
        return "Error: Invalid expression. Only numbers and math operators are allowed.";
      }
      // Replace ^ with ** for exponentiation
      const expr = sanitized.replace(/\^/g, "**");
      const result = new Function(`"use strict"; return (${expr})`)();
      return String(result);
    } catch {
      return "Error: Could not evaluate expression.";
    }
  },
};

const datetime: AgentTool = {
  name: "datetime",
  description: "Get the current date and time.",
  parameters: "none",
  execute: async () => {
    return new Date().toLocaleString();
  },
};

const webFetch: AgentTool = {
  name: "web_fetch",
  description: "Fetch the text content of a URL. May fail due to CORS restrictions.",
  parameters: "url (e.g. \"https://api.example.com/data\")",
  execute: async (args) => {
    const url = args.trim();
    try {
      new URL(url);
    } catch {
      return "Error: Invalid URL.";
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        return `Error: HTTP ${response.status} ${response.statusText}`;
      }
      const text = await response.text();
      // Truncate to avoid blowing up context
      return text.length > 2000 ? text.slice(0, 2000) + "\n...(truncated)" : text;
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : "Fetch failed"}`;
    }
  },
};

const peerMessage: AgentTool = {
  name: "send_message",
  description: "Send a text message to the connected peer.",
  parameters: "message text",
  execute: async (args, context) => {
    if (!context.sendPeerMessage) {
      return "Error: No peer connected.";
    }
    context.sendPeerMessage(args.trim());
    return "Message sent.";
  },
};

export const AGENT_TOOLS: AgentTool[] = [calculator, datetime, webFetch, peerMessage];

export function buildToolDescriptions(): string {
  return AGENT_TOOLS.map(
    (t) => `- ${t.name}: ${t.description} Parameters: ${t.parameters}`
  ).join("\n");
}

export async function executeTool(
  name: string,
  args: string,
  context: ToolContext
): Promise<string> {
  const tool = AGENT_TOOLS.find((t) => t.name === name);
  if (!tool) return `Error: Unknown tool "${name}".`;
  return tool.execute(args, context);
}
