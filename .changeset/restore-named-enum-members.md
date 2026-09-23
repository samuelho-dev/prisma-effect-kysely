---
'prisma-effect-kysely': patch
---

Restore generated TypeScript enum members alongside Effect enum codecs so application callsites can use named values such as `StatusEnum.ACTIVE`, including mapped string and integer storage values.
