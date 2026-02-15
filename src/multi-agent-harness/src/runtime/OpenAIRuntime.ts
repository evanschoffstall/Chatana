import { spawn } from "child_process";

type RuntimeToolHandler = (args: any) => Promise<any>;

export interface RuntimeTool {
  name: string;
  description: string;
  schema: Record<string, any>;
  handler: RuntimeToolHandler;
}

export interface RuntimeMcpServer {
  name: string;
  version: string;
  tools: RuntimeTool[];
}

type QueryOptions = {
  model?: string;
  systemPrompt?: string;
  mcpServers?: Record<string, RuntimeMcpServer | any>;
  allowedTools?: string[];
  abortController?: AbortController;
  resume?: string;
};

type QueryInput = {
  prompt: string;
  options?: QueryOptions;
};

type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

const sessionHistory = new Map<string, Message[]>();

export function tool(
  name: string,
  description: string,
  schema: Record<string, any>,
  handler: RuntimeToolHandler,
): RuntimeTool {
  return { name, description, schema, handler };
}

export function createSdkMcpServer(config: RuntimeMcpServer): RuntimeMcpServer {
  return config;
}

function isOptionalZod(schema: any): boolean {
  return Boolean(
    schema?._def?.typeName === "ZodOptional" || schema?.isOptional?.(),
  );
}

function unwrapZod(schema: any): any {
  let current = schema;
  while (current?._def?.innerType) {
    current = current._def.innerType;
  }
  return current;
}

function zodToJsonSchema(schema: any): any {
  const unwrapped = unwrapZod(schema);
  const typeName = unwrapped?._def?.typeName;

  if (!typeName) {
    return { type: "string" };
  }

  if (typeName === "ZodString") return { type: "string" };
  if (typeName === "ZodNumber") return { type: "number" };
  if (typeName === "ZodBoolean") return { type: "boolean" };
  if (typeName === "ZodEnum")
    return { type: "string", enum: unwrapped._def.values ?? [] };
  if (typeName === "ZodArray") {
    return { type: "array", items: zodToJsonSchema(unwrapped._def.type) };
  }

  if (typeName === "ZodObject") {
    const shape =
      typeof unwrapped._def.shape === "function" ? unwrapped._def.shape() : {};
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      if (!isOptionalZod(value)) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
      additionalProperties: false,
    };
  }

  return { type: "string" };
}

function objectShapeToJsonSchema(shape: Record<string, any>): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape ?? {})) {
    properties[key] = zodToJsonSchema(value);
    if (!isOptionalZod(value)) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

function extractToolText(result: any): string {
  if (typeof result === "string") {
    return result;
  }

  const content = result?.content;
  if (Array.isArray(content)) {
    return content
      .map((item) =>
        typeof item?.text === "string" ? item.text : JSON.stringify(item),
      )
      .join("\n");
  }

  return JSON.stringify(result ?? {});
}

function buildToolCatalog(options: QueryOptions | undefined): {
  tools: Array<{ name: string; description: string; parameters: any }>;
  handlers: Map<string, RuntimeToolHandler>;
} {
  const tools: Array<{ name: string; description: string; parameters: any }> =
    [];
  const handlers = new Map<string, RuntimeToolHandler>();
  const allowed = new Set(options?.allowedTools ?? []);

  for (const [serverName, serverConfig] of Object.entries(
    options?.mcpServers ?? {},
  )) {
    const serverTools: RuntimeTool[] = Array.isArray(serverConfig?.tools)
      ? serverConfig.tools
      : [];

    for (const serverTool of serverTools) {
      const prefixedName = `mcp__${serverName}__${serverTool.name}`;
      if (
        allowed.size > 0 &&
        !allowed.has(prefixedName) &&
        !allowed.has(serverTool.name)
      ) {
        continue;
      }

      tools.push({
        name: prefixedName,
        description: serverTool.description,
        parameters: objectShapeToJsonSchema(serverTool.schema),
      });

      handlers.set(prefixedName, serverTool.handler);
      handlers.set(serverTool.name, serverTool.handler);
    }
  }

  return { tools, handlers };
}

function buildRuntimePrompt(
  prompt: string,
  options: QueryOptions | undefined,
  history: Message[],
  tools: Array<{ name: string; description: string; parameters: any }>,
): string {
  const systemPrompt = options?.systemPrompt ?? "You are a coding assistant.";
  const historyText = history
    .slice(-20)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");

  const toolsText = JSON.stringify(tools, null, 2);

  return [
    "You are running as an autonomous coding agent runtime.",
    "You MUST output exactly one JSON object and nothing else.",
    "Valid outputs:",
    '1) {"type":"tool_call","name":"<tool-name>","arguments":{...}}',
    '2) {"type":"final","content":"<final assistant text>"}',
    "If a tool is needed, emit tool_call only.",
    "If no tool is needed, emit final.",
    "",
    `SYSTEM PROMPT:\n${systemPrompt}`,
    "",
    `AVAILABLE TOOLS (JSON Schema):\n${toolsText}`,
    "",
    `CONVERSATION HISTORY:\n${historyText || "(none)"}`,
    "",
    `NEW USER TASK:\n${prompt}`,
  ].join("\n");
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

async function runCopilotPrompt(
  prompt: string,
  model: string,
  abortController?: AbortController,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      "copilot",
      [
        "-p",
        prompt,
        "-s",
        "--stream",
        "off",
        "--allow-all-tools",
        "--no-ask-user",
        "--model",
        model,
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    const onAbort = () => {
      child.kill("SIGTERM");
      reject(new Error("AbortError"));
    };

    abortController?.signal.addEventListener("abort", onAbort, { once: true });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      abortController?.signal.removeEventListener("abort", onAbort);

      if (code !== 0) {
        reject(
          new Error(
            `copilot exited with code ${code}: ${stderr.trim() || "unknown error"}`,
          ),
        );
        return;
      }

      resolve(stdout.trim());
    });
  });
}

export async function* query({
  prompt,
  options,
}: QueryInput): AsyncGenerator<any, void> {
  const model = options?.model ?? "gpt-4.1";
  const sessionId = options?.resume ?? crypto.randomUUID();
  const startedAt = Date.now();
  const history = sessionHistory.get(sessionId) ?? [];

  if (history.length === 0 && options?.systemPrompt) {
    history.push({ role: "system", content: options.systemPrompt });
  }
  history.push({ role: "user", content: prompt });

  const { tools, handlers } = buildToolCatalog(options);
  let iterations = 0;

  while (iterations < 24) {
    iterations += 1;

    const runtimePrompt = buildRuntimePrompt(prompt, options, history, tools);
    const rawResponse = await runCopilotPrompt(
      runtimePrompt,
      model,
      options?.abortController,
    );

    const jsonText = extractFirstJsonObject(rawResponse);
    let parsed: any = null;
    if (jsonText) {
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        parsed = null;
      }
    }

    if (!parsed || typeof parsed !== "object") {
      const fallback = rawResponse || "Unable to generate a response.";
      history.push({ role: "assistant", content: fallback });
      yield {
        type: "assistant",
        message: { content: [{ type: "text", text: fallback }] },
        session_id: sessionId,
        uuid: crypto.randomUUID(),
      };
      break;
    }

    const blocks: Array<{
      type: "text" | "tool_use";
      text?: string;
      id?: string;
      name?: string;
      input?: any;
    }> = [];

    if (parsed.type === "tool_call" && typeof parsed.name === "string") {
      const toolCallId = crypto.randomUUID();
      const toolArgs =
        parsed.arguments && typeof parsed.arguments === "object"
          ? parsed.arguments
          : {};

      blocks.push({
        type: "tool_use",
        id: toolCallId,
        name: parsed.name,
        input: toolArgs,
      });

      yield {
        type: "assistant",
        message: { content: blocks },
        session_id: sessionId,
        uuid: crypto.randomUUID(),
      };

      const handler = handlers.get(parsed.name);
      let toolResultText: string;
      if (!handler) {
        toolResultText = `Tool not found: ${parsed.name}`;
      } else {
        try {
          const result = await handler(toolArgs);
          toolResultText = extractToolText(result);
        } catch (error) {
          toolResultText = `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      history.push({
        role: "assistant",
        content: `[TOOL_CALL] ${parsed.name} ${JSON.stringify(toolArgs)}`,
      });
      history.push({
        role: "tool",
        content: toolResultText,
      });

      continue;
    }

    const assistantText =
      parsed.type === "final" && typeof parsed.content === "string"
        ? parsed.content
        : rawResponse;

    if (assistantText.trim().length > 0) {
      blocks.push({ type: "text", text: assistantText });
    }

    if (blocks.length > 0) {
      yield {
        type: "assistant",
        message: { content: blocks },
        session_id: sessionId,
        uuid: crypto.randomUUID(),
      };
    }

    history.push({ role: "assistant", content: assistantText });
    break;
  }

  sessionHistory.set(sessionId, history.slice(-100));

  yield {
    type: "result",
    subtype: "success",
    session_id: sessionId,
    total_cost_usd: 0,
    duration_ms: Date.now() - startedAt,
    result: "Completed",
    uuid: crypto.randomUUID(),
  };
}
