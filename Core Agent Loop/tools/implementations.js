const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

// Allowlist for shell commands
const ALLOWED_SHELL_PREFIXES = [
  'ls', 'cat', 'grep', 'find', 'echo', 'pwd',
  'git status', 'git log', 'git diff',
  'node --version', 'npm list'
];

// ── TOOL FUNCTIONS ────────────────────────────────────────

function readFile({ path: filePath }) {
  const resolved = path.resolve(process.cwd(), filePath);

  // Path traversal protection
  if (!resolved.startsWith(process.cwd())) {
    throw new Error('Access denied: cannot read outside working directory');
  }

  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(resolved, 'utf8');

  // Truncate to prevent flooding context window
  if (content.length > 8000) {
    return content.substring(0, 8000) + '\n\n[...truncated at 8000 chars. File is larger.]';
  }

  return content;
}

function writeFile({ path: filePath, content }) {
  const resolved = path.resolve(process.cwd(), filePath);

  if (!resolved.startsWith(process.cwd())) {
    throw new Error('Access denied: cannot write outside working directory');
  }

  // Create parent directories if missing
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, 'utf8');

  return `Written successfully: ${filePath} (${content.length} chars)`;
}

function listDirectory({ path: dirPath }) {
  const resolved = path.resolve(process.cwd(), dirPath);

  if (!resolved.startsWith(process.cwd())) {
    throw new Error('Access denied: cannot list outside working directory');
  }

  if (!fs.existsSync(resolved)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }

  const entries = fs.readdirSync(resolved, { withFileTypes: true });

  return entries.map(e => ({
    name: e.name,
    type: e.isDirectory() ? 'directory' : 'file'
  }));
}

function runShell({ command }) {
  // Allowlist check
  const isAllowed = ALLOWED_SHELL_PREFIXES.some(prefix =>
    command.trim().startsWith(prefix)
  );

  if (!isAllowed) {
    const base = command.trim().split(' ')[0];
    throw new Error(
      `'${base}' is not in the allowlist. Allowed: ${ALLOWED_SHELL_PREFIXES.join(', ')}`
    );
  }

  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      timeout: 10000,          // 10 second timeout
      maxBuffer: 1024 * 50     // 50KB output limit
    }).toString().trim();

    return output || '(command ran with no output)';
  } catch (err) {
    if (err.stdout) return err.stdout.toString().trim();
    throw new Error(`Shell error: ${err.message}`);
  }
}

// ── DISPATCH ─────────────────────────────────────────────

const TOOL_REGISTRY = {
  read_file:       readFile,
  write_file:      writeFile,
  list_directory:  listDirectory,
  run_shell:       runShell
};

async function executeTool(toolName, input) {
  const fn = TOOL_REGISTRY[toolName];

  if (!fn) {
    return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
  }

  try {
    const result = fn(input);
    return JSON.stringify({ success: true, result });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error.message,
      hint: `Tool '${toolName}' failed. Try different inputs or a different approach.`
    });
  }
}

module.exports = { executeTool };