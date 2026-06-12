import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export interface LlmMessageParams {
  /**
   * Prompt système. Passer un tableau de blocs `text` permet d'y placer un
   * `cache_control: { type: 'ephemeral' }` pour activer le prompt caching sur
   * une portion stable (ex: gros catalogue identique à chaque appel).
   */
  system?: string | Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  tools?: Anthropic.Tool[];
  /**
   * Force le LLM à appeler un tool précis (ou n'importe quel tool). Sans ça,
   * Claude peut répondre en texte même quand des tools sont fournis.
   */
  toolChoice?: Anthropic.MessageCreateParams['tool_choice'];
  model?: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
    this.model = this.configService.get<string>('LLM_MODEL') || DEFAULT_MODEL;
  }

  async createMessage(
    params: LlmMessageParams,
  ): Promise<Anthropic.Message> {
    const model = params.model || this.model;

    const response = await this.client.messages.create({
      model,
      max_tokens: params.maxTokens || 1024,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
      tool_choice: params.toolChoice,
    });

    this.logger.debug(
      `[llm] ${model} — in: ${response.usage.input_tokens}, out: ${response.usage.output_tokens}`,
    );

    return response;
  }
}
