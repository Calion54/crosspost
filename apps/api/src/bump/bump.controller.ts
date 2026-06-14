import { Controller, Post } from '@nestjs/common';
import { BumpService } from './bump.service.js';
import type { BumpTickResult } from './bump.queue.js';

@Controller('bump')
export class BumpController {
  constructor(private readonly bumpService: BumpService) {}

  /**
   * Déclenche manuellement un tick de remontée (même logique que le tick
   * horaire) et retourne immédiatement le résumé de la sélection. Pratique
   * pour tester sans attendre le scheduler.
   */
  @Post('run')
  run(): Promise<BumpTickResult> {
    return this.bumpService.runTick();
  }
}
