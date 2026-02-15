# Chatana

<div align="center">

![Chatana Logo](https://raw.githubusercontent.com/brendankowitz/chatana/main/icon.png)

### AI-Powered Multi-Agent Orchestration for VS Code

**Chatana** transforms your IDE into a collaborative environment where a team of AI agents works alongside you. It is now configured for **GitHub Copilot CLI workflows** and provides a visual orchestration layer for multi-agent coding inside VS Code.

This repository is a **fork of the Clautana/Chatana project** and continues development with Copilot-oriented model defaults and prompts.

</div>

<div align="center">

![Chatana Screenshot](https://raw.githubusercontent.com/brendankowitz/chatana/main/docs/assets/Screenshot_Styled.jpg)

</div>

---

## 🚀 Why Chatana?

Coding complex features requires more than just a chat window. It needs a more structured workflow. **Chatana** is the visual orchestration layer for a Copilot-oriented multi-agent workflow.

It transforms the "Feature-First" development lifecycle into an interactive IDE experience. Chatana provides a central **Orchestrator** that:

1.  **Explores & Plans**: Scaffolds features and manages technical investigations.
2.  **Formalizes Decisions**: Helps transition investigations into Architecture Decision Records (ADRs).
3.  **Executes & Delegates**: Spawns specialized agents to implement tasks.
4.  **Visualizes Progress**: Manages the entire team on a real-time Kanban board.

## ✨ Key Features

- **🤖 Intelligent Orchestrator**: The "brain" that drives the Feature-First lifecycle, from exploration to finalization.
- **👥 Specialized Agent Pool**: Directly integrates agents from the, such as ADR Analyzers and specialized Coding Agents.
- **📋 Kanban Integration**: Visualizes "User Stories" and tasks as they progress through the workflow.
- **🔌 MCP-Native**: Built on the **Model Context Protocol (MCP)**, allowing agents to use existing and built-in MCP tools.
- **🧠 Persistent Memory**: Agents remember architectural decisions, facts, and "lessons learned" across sessions.
- **🔒 File Claims System**: Prevents agent conflicts by allowing workers to "claim" files they are actively editing.
- **📨 Agent-to-Agent Messaging**: Workers coordinate via an internal email-like system, handing off tasks and requesting reviews.

## 🛠️ Installation & Setup

### Prerequisites

- **VS Code**: Version 1.84.0 or higher.
- **GitHub Copilot CLI**: Install globally and authenticate (`npm install -g @github/copilot`).
- **Node.js & npm**: Required for building the extension from source.

### Building from Source

1.  Clone the repository:
    ```bash
    git clone https://github.com/ignixa/chatana.git
    ```
2.  Navigate to the extension directory:
    ```bash
    cd src/multi-agent-harness
    ```
3.  Install dependencies and build:
    ```bash
    npm install
    npm run build
    ```
4.  **Launch**: Open the project in VS Code and press `F5` to start the Extension Host.

## 📖 Usage Guide

### 1. Initialize

Open your project folder in the Extension Host window. Run the command:
`Chatana: Initialize Chatana for Project`
This creates the necessary `.chatana` directory for tracking state.

### 2. Start the Orchestrator

Click the **Chatana** icon in the Activity Bar to open the panel. You'll see the Orchestrator chat interface.

### 3. Submit a Task

Type a high-level request.

> "Refactor the authentication service to use JWTs instead of sessions."

### 4. Watch it Work

- **Plan**: The Orchestrator will analyze your code and propose a plan.
- **Kanban**: Open the **Kanban Board** (top right icon) to see the created User Stories.
- **Execution**: Worker agents will spawn, appear in the "Agents" list, and start picking up tickets. You can watch their terminal output and file changes in real-time.

### 5. Review & Complete

As agents finish tasks, they will move cards to "Review" or "Done". You can inspect their changes and provide feedback directly to the Orchestrator.

## ⚙️ Configuration

You can customize Chatana in your VS Code `settings.json`:

| Setting                       | Default   | Description                                                                       |
| :---------------------------- | :-------- | :-------------------------------------------------------------------------------- |
| `chatana.coordinatorModel`    | `gpt-4.1` | Model for the Orchestrator (via Copilot CLI, e.g., GPT-5, GPT-4.1, GPT-4.1-mini). |
| `chatana.workerModel`         | `gpt-4.1` | Model for Worker Agents.                                                          |
| `chatana.maxConcurrentAgents` | `5`       | Max number of active workers allowed.                                             |
| `chatana.autoReview`          | `false`   | Automatically spawn a Reviewer agent when tasks complete.                         |
| `chatana.memory.enabled`      | `true`    | Enable persistent memory (facts/lessons).                                         |
| `chatana.showClaimsInEditor`  | `true`    | Show visual indicators for files claimed by agents.                               |

## 🏗️ Architecture

Chatana is a hybrid VS Code extension + React Webview application.

- **`src/coordinator/`**: The brain. Contains `OrchestratorAgent.ts` and `AgentPool.ts`.
- **`src/mcp/`**: The hands. Implementation of MCP servers for Mail, Memory, and Tools.
- **`src/kanban/`**: The tracker. Logic for the file-based Kanban system (`.chatana/workitems`).
- **`webview-ui/`**: The face. A React/Vite application that renders the chat, board, and agent views.

## 📄 License

This project uses a dual-license contribution model in [LICENSE](LICENSE):

- Original upstream code remains under BSD 3-Clause copyright/terms.
- New contributions in this fork are additionally licensed under MIT.
