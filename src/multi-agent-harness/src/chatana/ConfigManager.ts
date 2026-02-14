import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { ChatanaConfig } from "./types";
import { validateChatanaConfig } from "./validation";

/**
 * Manages the .chatana/ folder and configuration for a workspace.
 *
 * Folder structure:
 * .chatana/
 * ├── config.json      # Main configuration
 * ├── memory/
 * │   ├── playbooks.json
 * │   ├── facts.json
 * │   └── sessions.json
 * ├── messages/        # Inter-agent messages (markdown with YAML frontmatter)
 * ├── agents/          # Custom agent profiles (JSON)
 * ├── hooks/           # Custom hook scripts (optional)
 * └── context/         # Additional context files
 */
export class ConfigManager {
  private config: ChatanaConfig | null = null;
  private configPath: string;
  private memoryPath: string;
  private workspaceRoot: string;
  private configChangeListeners: Array<() => void> = [];

  constructor(workspaceRoot?: string) {
    this.workspaceRoot =
      workspaceRoot ??
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
      process.cwd();

    this.configPath = path.join(this.workspaceRoot, ".chatana", "config.json");
    this.memoryPath = path.join(this.workspaceRoot, ".chatana", "memory");
  }

  /**
   * Initialize the .chatana folder structure
   */
  async initialize(): Promise<void> {
    const chatanaDir = path.join(this.workspaceRoot, ".chatana");

    // Create directories
    await fs.mkdir(chatanaDir, { recursive: true });
    await fs.mkdir(path.join(chatanaDir, "memory"), { recursive: true });
    await fs.mkdir(path.join(chatanaDir, "messages"), { recursive: true });
    await fs.mkdir(path.join(chatanaDir, "agents"), { recursive: true });
    await fs.mkdir(path.join(chatanaDir, "hooks"), { recursive: true });
    await fs.mkdir(path.join(chatanaDir, "context"), { recursive: true });

    // Create default config if it doesn't exist
    try {
      await fs.access(this.configPath);
    } catch {
      const defaultConfig: ChatanaConfig = {
        name: path.basename(this.workspaceRoot),
        description: "Add a description of your project here",
        standards: {
          rules: [
            "Follow existing code patterns",
            "Write tests for new functionality",
            "Use meaningful variable and function names",
          ],
        },
        agents: {
          maxConcurrent: 5,
          autoReview: true,
          contextFiles: ["README.md", "package.json"],
        },
        hooks: [
          {
            name: "auto-review",
            trigger: { type: "onAgentFinished" },
            action: {
              type: "sendMessage",
              config: {
                to: "orchestrator",
                subject: "Agent completed - review recommended",
                body: "Agent {{agent.name}} finished task: {{agent.focus}}",
              },
            },
            enabled: true,
            priority: 10,
          },
        ],
        memory: {
          enabled: true,
          decayDays: 90,
          maxEntries: {
            playbooks: 100,
            facts: 500,
            sessions: 1000,
          },
          autoCapture: {
            solutions: true,
            errorFixes: true,
            decisions: true,
          },
        },
      };

      await fs.writeFile(
        this.configPath,
        JSON.stringify(defaultConfig, null, 2),
        "utf-8"
      );
    }

    // Initialize empty memory files if they don't exist (YML format)
    const memoryFiles = ["playbooks.yml", "facts.yml", "sessions.yml"];
    for (const file of memoryFiles) {
      const filePath = path.join(this.memoryPath, file);
      try {
        await fs.access(filePath);
      } catch {
        // Create empty YML file with proper structure
        await fs.writeFile(filePath, "entries: []\n", "utf-8");
      }
    }

    // Migrate old JSON files to YML if they exist
    const oldMemoryFiles = ["playbooks.json", "facts.json", "sessions.json"];
    for (const file of oldMemoryFiles) {
      const oldPath = path.join(this.memoryPath, file);
      const newFile = file.replace(".json", ".yml");
      const newPath = path.join(this.memoryPath, newFile);

      try {
        await fs.access(oldPath);
        // Old file exists, check if new file is empty or doesn't exist
        let shouldMigrate = false;
        try {
          const newContent = await fs.readFile(newPath, "utf-8");
          shouldMigrate = newContent.trim() === "" || newContent.trim() === "entries: []";
        } catch {
          shouldMigrate = true;
        }

        if (shouldMigrate) {
          // Read old JSON content and migrate to YML
          const oldContent = await fs.readFile(oldPath, "utf-8");
          try {
            const entries = JSON.parse(oldContent);
            if (Array.isArray(entries) && entries.length > 0) {
              // Import using MemoryManager is handled separately
              // For now, just create a backup note
              const backupPath = oldPath + ".migrated";
              await fs.rename(oldPath, backupPath);
              console.log(`Migrated ${file} to ${newFile}. Original backed up to ${backupPath}`);
            }
          } catch {
            // Invalid JSON, ignore
          }
        }
      } catch {
        // Old file doesn't exist, nothing to migrate
      }
    }
  }

  /**
   * Load configuration from .chatana/config.json
   */
  async loadConfig(): Promise<ChatanaConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const content = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(content);

      // Validate using Zod schema
      const validation = validateChatanaConfig(parsed);
      if (!validation.success) {
        throw new Error(`Invalid config format: ${validation.error}`);
      }

      this.config = validation.data!;
      return this.config;
    } catch (error) {
      // If file doesn't exist or is invalid, return minimal default config
      // Don't cache this default - allow re-loading if file is created later
      const defaultConfig: ChatanaConfig = {
        name: path.basename(this.workspaceRoot),
        agents: {
          maxConcurrent: 5,
        },
      };

      // Log the error for debugging
      if (error instanceof Error) {
        console.warn(`Failed to load config from ${this.configPath}: ${error.message}`);
      }

      return defaultConfig;
    }
  }

  /**
   * Save configuration to .chatana/config.json
   */
  async saveConfig(config: ChatanaConfig): Promise<void> {
    try {
      // Validate using Zod schema
      const validation = validateChatanaConfig(config);
      if (!validation.success) {
        throw new Error(`Invalid config: ${validation.error}`);
      }

      // Ensure the .chatana directory exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });

      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), "utf-8");
      this.config = config;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save config to ${this.configPath}: ${message}`);
    }
  }

  /**
   * Get the current config (cached)
   */
  async getConfig(): Promise<ChatanaConfig> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config || { name: '', agents: { maxConcurrent: 5 } };
  }

  /**
   * Check if .chatana folder exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(path.join(this.workspaceRoot, ".chatana"));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the workspace root
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * Get the .chatana folder path
   */
  getChatanaPath(): string {
    return path.join(this.workspaceRoot, ".chatana");
  }

  /**
   * Get the memory folder path
   */
  getMemoryPath(): string {
    return this.memoryPath;
  }

  /**
   * Get the messages folder path (for inter-agent mail)
   */
  getMessagesPath(): string {
    return path.join(this.workspaceRoot, ".chatana", "messages");
  }

  /**
   * Get the agents folder path (for agent profiles)
   */
  getAgentsPath(): string {
    return path.join(this.workspaceRoot, ".chatana", "agents");
  }

  /**
   * Read a context file from .chatana/context/
   */
  async readContextFile(filename: string): Promise<string | null> {
    try {
      const filePath = path.join(this.workspaceRoot, ".chatana", "context", filename);
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Write a context file to .chatana/context/
   */
  async writeContextFile(filename: string, content: string): Promise<void> {
    if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      throw new Error("Invalid filename: must be a simple filename without path separators");
    }

    try {
      const contextDir = path.join(this.workspaceRoot, ".chatana", "context");
      await fs.mkdir(contextDir, { recursive: true });

      const filePath = path.join(contextDir, filename);
      await fs.writeFile(filePath, content, "utf-8");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to write context file ${filename}: ${message}`);
    }
  }

  /**
   * Get all context files
   */
  async getContextFiles(): Promise<string[]> {
    try {
      const contextDir = path.join(this.workspaceRoot, ".chatana", "context");
      const files = await fs.readdir(contextDir);
      return files.filter((f) => !f.startsWith("."));
    } catch {
      return [];
    }
  }

  /**
   * Build the system prompt additions from config
   */
  async buildContextPrompt(): Promise<string> {
    const config = await this.loadConfig();
    const parts: string[] = [];

    if (config.name) {
      parts.push(`Project: ${config.name}`);
    }

    if (config.description) {
      parts.push(`Description: ${config.description}`);
    }

    if (config.standards?.rules && config.standards.rules.length > 0) {
      parts.push("Coding Standards:");
      for (const rule of config.standards.rules) {
        parts.push(`- ${rule}`);
      }
    }

    if (config.standards?.patterns && config.standards.patterns.length > 0) {
      parts.push("\nArchitecture Patterns:");
      for (const pattern of config.standards.patterns) {
        parts.push(`- ${pattern}`);
      }
    }

    // Read context files
    const contextFiles = await this.getContextFiles();
    for (const file of contextFiles) {
      const content = await this.readContextFile(file);
      if (content) {
        parts.push(`\n--- ${file} ---\n${content}`);
      }
    }

    return parts.join("\n");
  }

  /**
   * Update workflow mode
   */
  async updateWorkflowMode(mode: 'adr' | 'spec-kit' | 'hybrid' | 'auto'): Promise<void> {
    const config = await this.getConfig();
    config.workflow = config.workflow || {};
    config.workflow.mode = mode;
    await this.saveConfig(config);
    this.notifyConfigChanged();
  }

  /**
   * Register a listener for config changes
   */
  onConfigChanged(callback: () => void): void {
    this.configChangeListeners.push(callback);
  }

  /**
   * Notify all listeners that config has changed
   */
  private notifyConfigChanged(): void {
    this.configChangeListeners.forEach(listener => listener());
  }
}

/**
 * Singleton instance for the current workspace
 */
let globalConfigManager: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager();
  }
  return globalConfigManager;
}

export function initConfigManager(workspaceRoot: string): ConfigManager {
  globalConfigManager = new ConfigManager(workspaceRoot);
  return globalConfigManager;
}
