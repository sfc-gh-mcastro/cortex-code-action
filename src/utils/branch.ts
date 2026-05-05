export interface BranchNameOptions {
  prefix: string;
  entityType: "pr" | "issue";
  entityNumber: number;
}

export function generateBranchName(options: BranchNameOptions): string {
  const { prefix, entityType, entityNumber } = options;
  const timestamp = Date.now();
  return `${prefix}${entityType}-${entityNumber}-${timestamp}`;
}
