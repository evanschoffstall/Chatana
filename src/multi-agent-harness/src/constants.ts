/**
 * Command identifiers for the Chatana extension.
 * These must match the command IDs defined in package.json.
 */
export const COMMANDS = {
  OPEN_PANEL: 'chatana.openPanel',
  SUBMIT_TASK: 'chatana.submitTask',
  INIT_PROJECT: 'chatana.initProject',
  SPAWN_AGENT: 'chatana.spawnAgent',
  DESTROY_AGENT: 'chatana.destroyAgent',
  SEND_TO_AGENT: 'chatana.sendToAgent',
  STOP_ALL: 'chatana.stopAll',
  VIEW_STATUS: 'chatana.viewStatus',
  REFRESH_CLAIMS: 'chatana.refreshClaims',
  PAUSE_AGENT: 'chatana.pauseAgent',
  RESUME_AGENT: 'chatana.resumeAgent',
  OPEN_CONFIG: 'chatana.openConfig',
  VIEW_MEMORY: 'chatana.viewMemory',
  OPEN_AGENT_VIEW: 'chatana.openAgentView',
  // Kanban commands
  OPEN_KANBAN: 'chatana.openKanban',
  CREATE_WORKITEM: 'chatana.createWorkItem',
  REFRESH_KANBAN: 'chatana.refreshKanban',
  // Knowledge Explorer
  OPEN_KNOWLEDGE_EXPLORER: 'chatana.openKnowledgeExplorer',
  // Investigation Browser
  OPEN_INVESTIGATION_BROWSER: 'chatana.openInvestigationBrowser',
  // Message commands
  ARCHIVE_MESSAGE: 'chatana.archiveMessage',
  UNARCHIVE_MESSAGE: 'chatana.unarchiveMessage',
  VIEW_MESSAGE: 'chatana.viewMessage'
} as const;

/**
 * Configuration keys for the Chatana extension.
 * These correspond to the settings defined in package.json under contributes.configuration.
 */
export const CONFIG = {
  COORDINATOR_MODEL: 'chatana.coordinatorModel',
  WORKER_MODEL: 'chatana.workerModel',
  MAX_CONCURRENT_AGENTS: 'chatana.maxConcurrentAgents',
  MCP_SERVERS: 'chatana.mcpServers',
  SHOW_CLAIMS_IN_EDITOR: 'chatana.showClaimsInEditor',
  NOTIFY_ON_AGENT_MESSAGE: 'chatana.notifyOnAgentMessage',
  WORKING_DIRECTORY: 'chatana.workingDirectory',
  AGENT_COLOR_PALETTE: 'chatana.agentColorPalette',
  MEMORY_ENABLED: 'chatana.memory.enabled',
  MEMORY_DECAY_DAYS: 'chatana.memory.decayDays',
  HOOKS_ENABLED: 'chatana.hooks.enabled',
  AUTO_REVIEW: 'chatana.autoReview'
} as const;

/**
 * View identifiers for the Chatana extension.
 */
export const VIEWS = {
  PANEL: 'chatana.panel',
  AGENTS: 'chatana.agents',
  CLAIMS: 'chatana.claims',
  MESSAGES: 'chatana.messages'
} as const;

/**
 * Color theme identifiers for file claim decorations.
 */
export const COLORS = {
  CLAIM_EXCLUSIVE_BACKGROUND: 'chatana.claimExclusiveBackground',
  CLAIM_SHARED_BACKGROUND: 'chatana.claimSharedBackground'
} as const;

/**
 * Output channel names
 */
export const OUTPUT_CHANNELS = {
  ORCHESTRATOR: 'Chatana Orchestrator',
  AGENT_POOL: 'Chatana Agents',
  HOOKS: 'Chatana Hooks',
  MEMORY: 'Chatana Memory'
} as const;
