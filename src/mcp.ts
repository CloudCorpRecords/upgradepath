/**
 * upgradepath MCP server. Tools: plan_upgrade_path.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The computation is pure and local: no upstream API, no
 * authentication, and no configuration — the caller supplies
 * every version and breaking change the plan is based on.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { formatPayload, planUpgradePath, VERSION } from "./upgradepath.js";

const TOOLS = [
  {
    name: "plan_upgrade_path",
    description:
      "Plan a safe dependency upgrade from caller-supplied release facts: the ordered intermediate versions between the current and target versions, the breaking changes carried by each step, and a verdict. Versions and changes are never fetched; every fact is supplied.",
    inputSchema: {
      type: "object" as const,
      properties: {
        current: {
          type: "string",
          description: "Currently installed version, in x.y.z form",
        },
        name: {
          type: "string",
          description: "Dependency name",
        },
        releases: {
          type: "array",
          description: "Known releases of the dependency",
          items: {
            type: "object",
            properties: {
              breaking_changes: {
                type: "array",
                description: "Breaking changes introduced by this release (optional)",
                items: { type: "string" },
              },
              deprecated: {
                type: "boolean",
                description: "Whether this release is deprecated (optional)",
              },
              version: {
                type: "string",
                description: "Release version, in x.y.z form",
              },
            },
            required: ["version"],
          },
        },
        target: {
          type: "string",
          description: "Target version, in x.y.z form; must be greater than current",
        },
      },
      required: ["name", "current", "target", "releases"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "upgradepath", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "plan_upgrade_path") {
      out = planUpgradePath(args ?? {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
