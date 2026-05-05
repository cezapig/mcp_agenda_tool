/**
 * Base shape for all tool results.
 * `success: true` carries a typed `data` payload;
 * `success: false` carries a human-readable `error` string.
 */
export type ToolResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * A registered MCP-style tool.
 */
export interface Tool<TInput, TOutput> {
  name: string;
  description: string;
  /** Execute the tool with validated input */
  execute(input: TInput): ToolResult<TOutput>;
}

/**
 * Generic tool registry that maps tool names to their handlers.
 * Tools are registered at startup and called by name at runtime.
 */
export class ToolRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly tools: Map<string, Tool<any, any>> = new Map();

  register<TInput, TOutput>(tool: Tool<TInput, TOutput>): void {
    this.tools.set(tool.name, tool);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(name: string): Tool<any, any> | undefined {
    return this.tools.get(name);
  }

  listTools(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call(name: string, input: unknown): ToolResult<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Unknown tool: "${name}"` };
    }
    return tool.execute(input);
  }
}
