import type { ToolType } from '../domain/tool';
import type { ToolAdapter } from './ToolAdapter';

export class ToolAdapterRegistry {
  private readonly adapters = new Map<ToolType, ToolAdapter>();

  register(adapter: ToolAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  get(type: ToolType): ToolAdapter | null {
    return this.adapters.get(type) ?? null;
  }

  has(type: ToolType): boolean {
    return this.adapters.has(type);
  }

  list(): ToolAdapter[] {
    return [...this.adapters.values()];
  }
}
