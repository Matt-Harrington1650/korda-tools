import type { ToolType } from '../domain/tool';
import type { ToolAdapter } from '../execution/ToolAdapter';
import type { PluginManifest } from './PluginManifest';

export class PluginRegistry {
  private readonly manifestsById = new Map<string, PluginManifest>();
  private readonly manifestsByToolType = new Map<ToolType, PluginManifest>();
  private readonly adaptersByToolType = new Map<ToolType, ToolAdapter>();

  register(manifest: PluginManifest): void {
    const existingById = this.manifestsById.get(manifest.id);
    if (existingById && existingById !== manifest) {
      throw new Error(`Plugin id already registered: ${manifest.id}`);
    }

    const existingByType = this.manifestsByToolType.get(manifest.toolType);
    if (existingByType && existingByType.id !== manifest.id) {
      throw new Error(`Tool type already registered by plugin ${existingByType.id}: ${manifest.toolType}`);
    }

    this.manifestsById.set(manifest.id, manifest);
    this.manifestsByToolType.set(manifest.toolType, manifest);
    this.adaptersByToolType.delete(manifest.toolType);
  }

  registerMany(manifests: PluginManifest[]): void {
    manifests.forEach((manifest) => {
      this.register(manifest);
    });
  }

  getManifestById(id: string): PluginManifest | null {
    return this.manifestsById.get(id) ?? null;
  }

  getManifestByToolType(toolType: ToolType): PluginManifest | null {
    return this.manifestsByToolType.get(toolType) ?? null;
  }

  get(toolType: ToolType): ToolAdapter | null {
    const cachedAdapter = this.adaptersByToolType.get(toolType);
    if (cachedAdapter) {
      return cachedAdapter;
    }

    const manifest = this.getManifestByToolType(toolType);
    if (!manifest) {
      return null;
    }

    const adapter = manifest.adapterFactory();
    this.adaptersByToolType.set(toolType, adapter);
    return adapter;
  }

  listManifests(): PluginManifest[] {
    return [...this.manifestsById.values()];
  }

  clear(): void {
    this.manifestsById.clear();
    this.manifestsByToolType.clear();
    this.adaptersByToolType.clear();
  }
}
