import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export interface LlmMessageParams {
  system?: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  tools?: Anthropic.Tool[];
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
    });

    this.logger.debug(
      `[llm] ${model} — in: ${response.usage.input_tokens}, out: ${response.usage.output_tokens}`,
    );

    return response;
  }
}
