export type ExportTarget = string | null | { [condition: string]: ExportTarget };

interface PackageEntryPoints {
  main?: string;
  module?: string;
  types?: string;
  exports?: Record<string, ExportTarget>;
}

export interface PackageManifest extends PackageEntryPoints {
  name: string;
  version: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  publishConfig?: PackageEntryPoints & { access?: string; registry?: string };
}

export interface CheckedPackage {
  manifest: PackageManifest;
  files: string[];
  contentHash: string;
}

export interface PackageArtifact extends CheckedPackage {
  directory: string;
  tarball: string;
}

export interface WorkspacePackage {
  directory: string;
  source: string;
  manifest: PackageManifest;
}

export interface BrowserCheckResult {
  specifier: string;
  format: 'import' | 'require';
  cssAssets: string[];
  selectors: number;
  cssBytes: number;
}
