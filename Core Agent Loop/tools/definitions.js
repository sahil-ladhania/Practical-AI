
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the full contents of a text file. Returns file content as a string. Use to inspect code, configs, logs, or any text file. Fails if file does not exist.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path relative to working directory. Example: './src/index.js' or './package.json'"
          }
        },
        required: ["path"],
        additionalProperties: false
      }
    }
  },

  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file. Creates the file if it does not exist. Overwrites if it does. Use to save code, configs, or any text content.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path to write to. Example: './output/result.txt'"
          },
          content: {
            type: "string",
            description: "Full text content to write to the file."
          }
        },
        required: ["path", "content"],
        additionalProperties: false
      }
    }
  },

  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List all files and folders inside a directory. Returns an array of names with type (file or directory). Use to explore project structure.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory path to list. Use '.' for current directory.",
            default: "."
          }
        },
        required: ["path"],
        additionalProperties: false
      }
    }
  },

  {
    type: "function",
    function: {
      name: "run_shell",
      description: "Execute a safe, read-only shell command and return its output. ONLY these commands are allowed: ls, cat, grep, find, echo, pwd, git status, git log, git diff, node --version, npm list. Do NOT use for write or delete operations.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Shell command to run. Example: 'grep -r TODO ./src' or 'git status' or 'ls -la'"
          }
        },
        required: ["command"],
        additionalProperties: false
      }
    }
  }
];

module.exports = { TOOL_DEFINITIONS };
