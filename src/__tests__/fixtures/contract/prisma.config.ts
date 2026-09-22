import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import { definePrismaConfig } from 'prisma/config';

export default definePrismaConfig({
  orm: ormConfig({ contract: './src/__tests__/fixtures/contract/contract.prisma' }),
});
