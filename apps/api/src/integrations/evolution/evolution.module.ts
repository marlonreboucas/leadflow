import { Global, Module } from '@nestjs/common';
import { EvolutionClient } from './evolution.client';

@Global()
@Module({
  providers: [EvolutionClient],
  exports: [EvolutionClient],
})
export class EvolutionModule {}
