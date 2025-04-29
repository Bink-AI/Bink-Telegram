import { Inject, Injectable } from '@nestjs/common';
import { TelegramBot } from '../telegram-bot';
import { Handler } from './handler';
import { EHumanReviewAction } from '@/shared/constants/enums';
import { AiService } from '@/business/services/ai.service';
import { COMMAND_KEYS } from '../constants/command-keys';
@Injectable()
export class HumanReviewHandler implements Handler {
  constructor(
    @Inject(TelegramBot)
    private readonly bot: TelegramBot,
    @Inject(AiService)
    private readonly aiService: AiService,
  ) {}

  handler = async (data: {
    chatId: string;
    telegramId: string;
    messageId: number;
    queryId: string;
    cmd: string;
  }) => {
    try {
      // Answer the callback query to remove the loading state
      await this.bot.answerCallbackQuery(data.queryId);

      // Determine the action based on the user's response
      const action =
        data.cmd === COMMAND_KEYS.HUMAN_REVIEW_YES
          ? EHumanReviewAction.APPROVE
          : EHumanReviewAction.REJECT;

      // Delete the original message with buttons
      await this.bot.deleteMessage(data.chatId, data.messageId.toString());

      // Send the response with the action
      await this.aiService.handleSwap(data.telegramId, '', action as EHumanReviewAction);
    } catch (error) {
      console.error('Error in HumanReviewHandler:', error.message);
      await this.bot.sendMessage(
        data.chatId,
        '⚠️ System is currently experiencing high load. Our AI models are working overtime! Please try again in a few moments.',
      );
    }
  };
}
