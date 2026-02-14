import { createLspMcpTools } from "./LspMcpServer";
import { createMailMcpTools } from "./MailMcpServer";
import { createClaimsMcpTools } from "./ClaimsMcpServer";
import { createMemoryMcpTools } from "./MemoryMcpServer";
import { createWorkItemsMcpTools } from "./WorkItemsMcpServer";

/**
 * Creates an MCP server instance with all extension-provided tools.
 *
 * This combines:
 * - LSP tools (go-to-definition, find-references, hover, etc.)
 * - Mail tools (send_message, inbox, etc.)
 * - Claims tools (reserve_file_paths, release_claims, etc.)
 * - Memory tools (playbooks, facts, sessions)
 * - Work Items tools (list_workitems, create_workitem, assign_workitem, etc.)
 *
 * @param agentName - The name of the agent these tools are for
 * @returns An SDK MCP server instance
 */
export async function createExtensionMcpServer(agentName: string): Promise<any> {
  const { createSdkMcpServer } = await import("@anthropic-ai/claude-agent-sdk");

  // Get all tool definitions
  const [lspTools, mailTools, claimsTools, memoryTools, workItemsTools] = await Promise.all([
    createLspMcpTools(),
    createMailMcpTools(agentName),
    createClaimsMcpTools(agentName),
    createMemoryMcpTools(),
    createWorkItemsMcpTools(agentName),
  ]);

  // Create a single MCP server with all tools
  return createSdkMcpServer({
    name: "chatana",
    version: "1.0.0",
    tools: [...lspTools, ...mailTools, ...claimsTools, ...memoryTools, ...workItemsTools],
  });
}

/**
 * Get the list of all extension-provided tool names for permission configuration.
 */
export function getExtensionToolNames(): string[] {
  return [
    // LSP tools
    "mcp__chatana__lsp_go_to_definition",
    "mcp__chatana__lsp_find_references",
    "mcp__chatana__lsp_hover",
    "mcp__chatana__lsp_document_symbols",
    "mcp__chatana__lsp_workspace_symbols",
    "mcp__chatana__lsp_go_to_implementation",
    "mcp__chatana__lsp_incoming_calls",
    "mcp__chatana__lsp_outgoing_calls",
    "mcp__chatana__lsp_get_diagnostics",
    // Mail tools
    "mcp__chatana__send_message",
    "mcp__chatana__inbox",
    "mcp__chatana__mark_message_read",
    "mcp__chatana__delete_message",
    // Claims tools
    "mcp__chatana__reserve_file_paths",
    "mcp__chatana__release_claims",
    "mcp__chatana__get_claims",
    "mcp__chatana__check_availability",
    // Memory tools
    "mcp__chatana__memory_search_playbooks",
    "mcp__chatana__memory_get_playbook",
    "mcp__chatana__memory_save_playbook",
    "mcp__chatana__memory_search_facts",
    "mcp__chatana__memory_save_fact",
    "mcp__chatana__memory_search_sessions",
    "mcp__chatana__memory_get_recent_sessions",
    "mcp__chatana__memory_record_lesson",
    // Work Items tools
    "mcp__chatana__list_workitems",
    "mcp__chatana__get_workitem",
    "mcp__chatana__create_workitem",
    "mcp__chatana__move_workitem",
    "mcp__chatana__assign_workitem",
    "mcp__chatana__unassign_workitem",
    "mcp__chatana__update_workitem",
    "mcp__chatana__add_workitem_note",
    "mcp__chatana__cancel_workitem",
    "mcp__chatana__delete_workitem",
  ];
}
