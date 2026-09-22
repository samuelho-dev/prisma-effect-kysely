import type { DMMF } from '@prisma/generator-helper';

export interface DomainInfo {
  readonly name: string;
  readonly models: readonly DMMF.Model[];
}

/** Group Prisma 8 contract models by their namespace. */
export function detectDomains(dmmf: DMMF.Document) {
  const domains = new Map<string, DMMF.Model[]>();

  for (const model of dmmf.datamodel.models) {
    const name = model.schema ?? 'shared';
    const models = domains.get(name) ?? [];
    domains.set(name, [...models, model]);
  }

  if (domains.size === 0) {
    return [{ name: 'shared', models: [] }];
  }

  return Array.from(domains, ([name, models]) => ({ name, models })).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
